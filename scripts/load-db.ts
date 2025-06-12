import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import axios from "axios";
import { generateSentenceEmbedding } from "../lib/sentence-transformer-embedding";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const {
  PINECONE_API_KEY,
  PINECONE_INDEX_NAME,
  SENTENCE_TRANSFORMER_API_URL,
  NEXT_PUBLIC_TOKEN,
} = process.env;

const CRAFTSMEN_API_URL = "http://20.199.86.3/api/client/search";

const craftsToFetch = [
  "حداد",
  "نجار",
  "سباك",
  "كهربائي",
  "نقاش",
  "فني تكييف",
];

const embeddingDimension = 384;

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY!,
});

console.log("Environment variables check:", {
  PINECONE_API_KEY: !!PINECONE_API_KEY,
  PINECONE_INDEX_NAME: !!PINECONE_INDEX_NAME,
  SENTENCE_TRANSFORMER_API_URL: !!SENTENCE_TRANSFORMER_API_URL,
  NEXT_PUBLIC_TOKEN: !!NEXT_PUBLIC_TOKEN,
});

async function checkIndex() {
  try {
    const indexList = await pinecone.listIndexes();
    const indexes = indexList.indexes || [];
    const indexExists = indexes.some((index) => index.name === PINECONE_INDEX_NAME);
    console.log(`Index ${PINECONE_INDEX_NAME} exists: ${indexExists}`);
    return indexExists;
  } catch (error) {
    console.error("Error checking index:", error.message);
    return false;
  }
}

async function createIndex() {
  try {
    await pinecone.createIndex({
      name: PINECONE_INDEX_NAME!,
      dimension: embeddingDimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
    console.log(`Index ${PINECONE_INDEX_NAME} created successfully`);
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 seconds
  } catch (error) {
    if (error.message.includes("already exists")) {
      console.log(`Index ${PINECONE_INDEX_NAME} already exists. Skipping creation.`);
    } else {
      console.error("Error creating index:", error.message);
      throw error;
    }
  }
}

async function fetchCraftsmenData(craft: string, page: number = 1) {
  try {
    console.log(`Fetching ${craft} craftsmen data, page ${page}...`);
    const response = await axios.post(
      CRAFTSMEN_API_URL,
      {
        pagination: 100,
        page,
        craft,
      },
      {
        headers: {
          Authorization: NEXT_PUBLIC_TOKEN,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data) {
      console.warn(`No data in response for ${craft}, page ${page}`);
      return null;
    }

    if (response.data.status === true && response.data.data?.data) {
      console.log(`Successfully fetched ${response.data.data.data.length} ${craft} craftsmen from page ${page}`);
      return response.data.data;
    } else {
      console.warn(`Invalid response for ${craft}, page ${page}:`, response.data);
      return null;
    }
  } catch (error) {
    console.error(`API error for ${craft}, page ${page}:`, error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    } else if (error.request) {
      console.error("No response received:", error.request);
    }
    return null;
  }
}

function formatCraftsmanDescription(craftsman: any): { description: string; missingFields: string[] } {
  const missingFields: string[] = [];
  const defaults = {
    name: "حرفي مجهول",
    craftName: "غير محدد",
    address: "غير محدد",
    cities: ["مصر"],
    average_rating: "غير متوفر",
    number_of_ratings: 0,
    done_jobs_num: 0,
    active_jobs_num: 0,
    description: "لا يوجد وصف",
    status: "غير معروف",
    image: null,
  };

  if (!craftsman.name) missingFields.push("name");
  if (!craftsman.craft?.name) missingFields.push("craft.name");
  if (!craftsman.address) missingFields.push("address");
  if (!craftsman.cities || !craftsman.cities.length) missingFields.push("cities");
  if (!craftsman.average_rating) missingFields.push("average_rating");
  if (!craftsman.description) missingFields.push("description");
  if (!craftsman.status) missingFields.push("status");
  if (!craftsman.image) missingFields.push("image");

  let description = `اسم الحرفي: ${craftsman.name || defaults.name}\n`;
  description += `المهنة: ${craftsman.craft?.name || defaults.craftName}\n`;
  description += `العنوان: ${craftsman.address || defaults.address}\n`;

  const cities = craftsman.cities?.map((c: any) => c.city).filter(Boolean) || defaults.cities;
  description += `المدن: ${cities.join(", ")}\n`;

  if (craftsman.average_rating) {
    description += `التقييم: ${craftsman.average_rating} (عدد التقييمات: ${craftsman.number_of_ratings || defaults.number_of_ratings})\n`;
  } else {
    description += `التقييم: ${defaults.average_rating}\n`;
  }

  description += `الوظائف المنجزة: ${craftsman.done_jobs_num || defaults.done_jobs_num}\n`;
  description += `الوظائف النشطة: ${craftsman.active_jobs_num || defaults.active_jobs_num}\n`;

  description += `الوصف: ${craftsman.description || defaults.description}\n`;
  description += `الحالة: ${craftsman.status === "free" ? "متاح" : craftsman.status || defaults.status}\n`;

  if (craftsman.image) {
    description += `رابط الصورة: ${craftsman.image}\n`;
  }

  return { description, missingFields };
}

async function validateEmbedding(vector: number[] | null | undefined): Promise<boolean> {
  if (!vector || !Array.isArray(vector) || vector.length !== embeddingDimension) {
    console.warn("Invalid embedding:", {
      isArray: Array.isArray(vector),
      length: vector ? vector.length : "undefined",
      sample: vector && Array.isArray(vector) ? vector.slice(0, 5) : "N/A",
    });
    return false;
  }
  return true;
}

export const loadSampleData = async (clearIndex: boolean = false) => {
  console.log("Starting to load craftsmen data...");
  try {
    if (clearIndex) {
      console.log("Clearing existing index...");
      try {
        await pinecone.deleteIndex(PINECONE_INDEX_NAME!);
        console.log(`Index ${PINECONE_INDEX_NAME} deleted successfully`);
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
      } catch (error) {
        console.error("Error deleting index:", error.message);
      }
    }

    let indexExists = await checkIndex();
    if (!indexExists) {
      await createIndex();
      indexExists = await checkIndex();
      if (!indexExists) {
        throw new Error("Index creation failed or index not found after creation");
      }
    }

    const index = pinecone.Index(PINECONE_INDEX_NAME!);
    console.log(`Connected to index: ${PINECONE_INDEX_NAME}`);

    let totalDocuments = 0;
    let failedInsertions = 0;
    const missingFieldsStats: Record<string, number> = {};

    for (const craft of craftsToFetch) {
      console.log(`Processing craft: ${craft}`);
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const apiResponse = await fetchCraftsmenData(craft, currentPage);

        if (!apiResponse || !apiResponse.data || apiResponse.data.length === 0) {
          console.log(`No more data for ${craft}`);
          hasMorePages = false;
          continue;
        }

        const craftsmen = apiResponse.data;
        console.log(`Processing ${craftsmen.length} ${craft} craftsmen from page ${currentPage}`);

        for (const craftsman of craftsmen) {
          const craftsmanId = craftsman.id?.toString() || uuidv4();
          const craftsmanName = craftsman.name || "حرفي مجهول";
          const craftName = craftsman.craft?.name || "حرفي";
          const cities = craftsman.cities?.map((c: any) => c.city).filter(Boolean) || ["مصر"];
          const keywords = ["حرفي", craftName, ...cities];
          const embeddingText = keywords.join(", ");

          try {
            const { description, missingFields } = formatCraftsmanDescription(craftsman);
            missingFields.forEach((field) => {
              missingFieldsStats[field] = (missingFieldsStats[field] || 0) + 1;
            });

            let vectorArray: number[] = Array(embeddingDimension).fill(0); // Fallback zero vector
            let embeddingStatus = "failed";

            try {
              console.log(`Generating embedding for craftsman: ${craftsmanName} (${embeddingText})`);
              const embeddingResult = await generateSentenceEmbedding(embeddingText);
              vectorArray = embeddingResult.embedding;

              if (await validateEmbedding(vectorArray)) {
                embeddingStatus = "success";
              } else {
                console.warn(`Using fallback zero vector for ${craftsmanName} due to invalid embedding`);
              }
            } catch (error) {
              console.warn(`Embedding generation failed for ${craftsmanName}:`, error.message);
            }

            const vectorId = uuidv4();
            const vectorRecord = {
              id: vectorId,
              values: vectorArray,
              metadata: {
                id: craftsmanId,
                name: craftsmanName,
                category: craftName,
                description,
                rating: craftsman.average_rating?.toString() || "0",
                cities,
                keywords,
                timestamp: new Date().toISOString(),
                embeddingStatus,
                missingFields,
                // Only include image if it's a non-null string
                ...(craftsman.image ? { image: craftsman.image } : {}),
              },
            };

            console.log(`Vector to insert for ${craftsmanName}:`, {
              id: vectorId,
              name: craftsmanName,
              vectorSample: vectorRecord.values.slice(0, 5),
              vectorLength: vectorRecord.values.length,
              keywords: vectorRecord.metadata.keywords,
              missingFields,
              embeddingStatus,
            });

            await index.upsert([vectorRecord]);
            console.log(`Vector inserted with ID: ${vectorId}`);

            // Verify insertion with retry
            let verified = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const queryResult = await index.query({
                  id: vectorId,
                  topK: 1,
                  includeMetadata: true,
                  includeValues: true,
                });

                if (!queryResult.matches || queryResult.matches.length === 0) {
                  console.warn(`Inserted vector not found for ${craftsmanName} (ID: ${vectorId}), attempt ${attempt}`);
                  continue;
                }

                const retrievedVector = queryResult.matches[0];
                const hasVector = retrievedVector.values && Array.isArray(retrievedVector.values) && retrievedVector.values.length === embeddingDimension;
                const vectorSample = hasVector ? retrievedVector.values.slice(0, 5) : retrievedVector.values;

                console.log(`Retrieved vector for ${craftsmanName}:`, {
                  vectorValue: vectorSample,
                  vectorType: retrievedVector.values ? typeof retrievedVector.values : "undefined",
                  isArray: Array.isArray(retrievedVector.values),
                  metadata: retrievedVector.metadata,
                });

                if (!hasVector && embeddingStatus !== "failed") {
                  console.warn(`Vector field invalid for ${craftsmanName} (ID: ${vectorId})`, {
                    vectorValue: retrievedVector.values,
                    vectorType: retrievedVector.values ? typeof retrievedVector.values : "undefined",
                    isArray: Array.isArray(retrievedVector.values),
                    metadata: retrievedVector.metadata,
                  });
                } else {
                  console.log(`Vector verified for ${craftsmanName} (ID: ${vectorId})`, {
                    vectorLength: retrievedVector.values.length,
                    vectorSample,
                    keywordCount: (retrievedVector.metadata?.keywords as string[])?.length || 0,
                  });
                  verified = true;
                  break;
                }
              } catch (error) {
                console.warn(`Verification attempt ${attempt} failed for ${craftsmanName}:`, error.message);
              }
              await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
            }

            if (!verified) {
              console.warn(`Verification failed for ${craftsmanName} (ID: ${vectorId}) after 3 attempts, but counting as inserted`);
            }
            totalDocuments++; // Count as inserted regardless of verification

          } catch (error) {
            console.error(`Error processing craftsman ${craftsmanName}:`, error.message);
            failedInsertions++;
          }
        }

        if (apiResponse.last_page > currentPage) {
          currentPage++;
        } else {
          hasMorePages = false;
        }
      }
    }

    console.log(`Total craftsmen vectors inserted: ${totalDocuments}`);
    console.log(`Failed insertions: ${failedInsertions}`);
    console.log(`Missing fields statistics:`, missingFieldsStats);
    if (failedInsertions > 0) {
      console.warn("Some vectors were not inserted correctly. Check logs for details.");
    }
  } catch (error) {
    console.error("Error in loadSampleData:", error.message);
    throw error;
  }
};

async function deleteIndex() {
  try {
    await pinecone.deleteIndex(PINECONE_INDEX_NAME!);
    console.log(`Index ${PINECONE_INDEX_NAME} deleted successfully`);
    return true;
  } catch (error) {
    console.error("Error deleting index:", error.message);
    return false;
  }
}

async function debugDbContents() {
  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME!);
    const stats = await index.describeIndexStats();
    console.log(`Total vectors in ${PINECONE_INDEX_NAME}: ${stats.totalRecordCount || 0}`);

    if (stats.totalRecordCount > 0) {
      const sampleQuery = await index.query({
        vector: Array(embeddingDimension).fill(0),
        topK: 5,
        includeMetadata: true,
        includeValues: true,
      });

      sampleQuery.matches?.forEach((match: any) => {
        const hasVector = match.values && Array.isArray(match.values);
        const vectorSample = hasVector ? match.values.slice(0, 5) : match.values;
        console.log(`Vector ${match.id}:`, {
          name: match.metadata?.name || "No name",
          category: match.metadata?.category || "No category",
          cities: match.metadata?.cities || "No cities",
          keywords: match.metadata?.keywords || "No keywords",
          image: match.metadata?.image || "No image",
          embeddingStatus: match.metadata?.embeddingStatus || "Unknown",
          missingFields: match.metadata?.missingFields || [],
          vector_length: hasVector ? match.values.length : "No vector found",
          vector_sample: vectorSample,
          has_vector: hasVector,
          vector_type: match.values ? typeof match.values : "None",
          is_array: Array.isArray(match.values),
          metadata_fields: match.metadata ? Object.keys(match.metadata) : [],
        });
      });

      const allVectors = await index.query({
        vector: Array(embeddingDimension).fill(0),
        topK: stats.totalRecordCount,
        includeValues: true,
      });

      const invalidVectors = allVectors.matches?.filter(
        (match: any) => !match.values || !Array.isArray(match.values) || match.values.length !== embeddingDimension
      ) || [];

      console.log(`Vectors with invalid or missing values: ${invalidVectors.length}`);
      if (invalidVectors.length > 0) {
        console.warn("Sample invalid vectors:", invalidVectors.slice(0, 2).map((match: any) => ({
          id: match.id,
          vectorValue: match.values,
          vectorType: match.values ? typeof match.values : "undefined",
          isArray: Array.isArray(match.values),
        })));
      }
    }
  } catch (error) {
    console.error("Error debugging index contents:", error.message);
  }
}

async function testApiConnection() {
  console.log("Testing API connection...");
  try {
    const testResponse = await axios.post(
      CRAFTSMEN_API_URL,
      { pagination: 1, page: 1, craft: "سباك" },
      {
        headers: {
          Authorization: NEXT_PUBLIC_TOKEN,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    console.log("API connection test response status:", testResponse.status);
    console.log("API connection successful");
    console.log("Sample response data:", testResponse.data);
  } catch (error) {
    console.error("API connection test failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    console.log("Please verify the API endpoint and authentication token");
  }
}

async function testEmbeddingGeneration() {
  console.log("Testing embedding generation...");
  try {
    const testInput = "سباك في المنصورة";
    const result = await generateSentenceEmbedding(testInput);
    const vector = result.embedding;
    console.log("Embedding test result:", {
      input: testInput,
      isArray: Array.isArray(vector),
      length: vector ? vector.length : "undefined",
      sample: vector && Array.isArray(vector) ? vector.slice(0, 5) : "N/A",
      valid: await validateEmbedding(vector),
    });
  } catch (error) {
    console.error("Embedding generation test failed:", error.message);
  }
}

async function main() {
  try {
    await testApiConnection();
    await testEmbeddingGeneration();
    await loadSampleData(true);
    await debugDbContents();
    console.log("Script completed successfully");
  } catch (error) {
    console.error("Script failed:", error.message);
    process.exit(1);
  }
}

main();