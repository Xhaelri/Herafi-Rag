
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
    // Convert IndexList to array for compatibility
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
          region: "us-east-1", // Adjust region as needed
        },
      },
    });
    console.log(`Index ${PINECONE_INDEX_NAME} created successfully`);
    // Wait for index to be ready
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

    if (response.data && response.data.status === true) {
      console.log(`Successfully fetched ${response.data.data.data.length} ${craft} craftsmen from page ${page}`);
      return response.data.data;
    } else {
      console.error(`Error fetching ${craft} craftsmen:`, response.data);
      return null;
    }
  } catch (error) {
    console.error(`API error for ${craft}:`, error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    } else if (error.request) {
      console.error("No response received:", error.request);
    }
    return null;
  }
}

function formatCraftsmanDescription(craftsman: any): string {
  let description = `اسم الحرفي: ${craftsman.name}\n`;
  description += `المهنة: ${craftsman.craft?.name || "غير محدد"}\n`;
  description += `العنوان: ${craftsman.address || "غير محدد"}\n`;

  if (craftsman.cities && craftsman.cities.length > 0) {
    description += `المدن: ${craftsman.cities.map((c: any) => c.city).join(", ")}\n`;
  }

  if (craftsman.average_rating) {
    description += `التقييم: ${craftsman.average_rating} (عدد التقييمات: ${craftsman.number_of_ratings || 0})\n`;
  } else {
    description += "التقييم: غير متوفر\n";
  }

  description += `الوظائف المنجزة: ${craftsman.done_jobs_num || 0}\n`;
  description += `الوظائف النشطة: ${craftsman.active_jobs_num || 0}\n`;

  if (craftsman.description) {
    description += `الوصف: ${craftsman.description}\n`;
  }

  description += `الحالة: ${craftsman.status === "free" ? "متاح" : "مشغول"}\n`;

  if (craftsman.image) {
    description += `رابط الصورة: ${craftsman.image}\n`;
  }

  return description;
}

async function validateEmbedding(vector: number[] | null | undefined): Promise<boolean> {
  if (!vector || !Array.isArray(vector) || vector.length !== embeddingDimension) {
    console.error("Invalid embedding:", {
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
        // Wait for deletion to propagate
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
          const craftName = craftsman.craft?.name || "حرفي";
          const cities = craftsman.cities?.map((c: any) => c.city) || ["مصر"];
          const keywords = ["حرفي", craftName, ...cities];
          const embeddingText = keywords.join(", ");

          try {
            console.log(`Generating embedding for craftsman: ${craftsman.name} (${embeddingText})`);
            const embeddingResult = await generateSentenceEmbedding(embeddingText);
            const vectorArray = embeddingResult.embedding;

            if (!(await validateEmbedding(vectorArray))) {
              console.error(`Skipping insertion for ${craftsman.name} due to invalid embedding`);
              failedInsertions++;
              continue;
            }

            console.log("Embedding sample:", vectorArray.slice(0, 5));

            const vectorId = uuidv4();
            const vectorRecord = {
              id: vectorId,
              values: vectorArray,
              metadata: {
                id: craftsman.id.toString(),
                name: craftsman.name,
                category: craftName,
                description: formatCraftsmanDescription(craftsman),
                rating: craftsman.average_rating?.toString() || "0",
                cities: cities,
                keywords: keywords,
                timestamp: new Date().toISOString(),
                image: craftsman.image || null,
              },
            };

            console.log(`Vector to insert for ${craftsman.name}:`, {
              id: vectorId,
              name: craftsman.name,
              vectorSample: vectorRecord.values.slice(0, 5),
              vectorLength: vectorRecord.values.length,
              keywords: vectorRecord.metadata.keywords,
            });

            await index.upsert([vectorRecord]);
            console.log(`Vector inserted with ID: ${vectorId}`);

            // Verify insertion by querying the vector
            const queryResult = await index.query({
              id: vectorId,
              topK: 1,
              includeMetadata: true,
              includeValues: true,
            });

            if (!queryResult.matches || queryResult.matches.length === 0) {
              console.error(`Inserted vector not found for ${craftsman.name} (ID: ${vectorId})`);
              failedInsertions++;
              continue;
            }

            const retrievedVector = queryResult.matches[0];
            const hasVector = retrievedVector.values && Array.isArray(retrievedVector.values) && retrievedVector.values.length === embeddingDimension;
            const vectorSample = hasVector ? retrievedVector.values.slice(0, 5) : retrievedVector.values;

            console.log(`Retrieved vector for ${craftsman.name}:`, {
              vectorValue: vectorSample,
              vectorType: retrievedVector.values ? typeof retrievedVector.values : "undefined",
              isArray: Array.isArray(retrievedVector.values),
              metadata: retrievedVector.metadata,
            });

            if (!hasVector) {
              console.error(`Vector field invalid for ${craftsman.name} (ID: ${vectorId})`, {
                vectorValue: retrievedVector.values,
                vectorType: retrievedVector.values ? typeof retrievedVector.values : "undefined",
                isArray: Array.isArray(retrievedVector.values),
                metadata: retrievedVector.metadata,
              });
              failedInsertions++;
            } else {
              console.log(`Vector verified for ${craftsman.name} (ID: ${vectorId})`, {
                vectorLength: retrievedVector.values.length,
                vectorSample,
                keywordCount: (retrievedVector.metadata?.keywords as string[])?.length || 0,
              });
              totalDocuments++;
            }
          } catch (error) {
            console.error(`Error processing craftsman ${craftsman.name}:`, error.message);
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
      // Query a sample of vectors
      const sampleQuery = await index.query({
        vector: Array(embeddingDimension).fill(0), // Dummy vector for sampling
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
          vector_length: hasVector ? match.values.length : "No vector found",
          vector_sample: vectorSample,
          has_vector: hasVector,
          vector_type: match.values ? typeof match.values : "None",
          is_array: Array.isArray(match.values),
          metadata_fields: match.metadata ? Object.keys(match.metadata) : [],
        });
      });

      // Check for vectors with invalid values
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