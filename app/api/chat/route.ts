import { Pinecone } from "@pinecone-database/pinecone";
import { generateId, generateText, Message } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateSentenceEmbedding } from "@/lib/sentence-transformer-embedding";
import { NextResponse } from "next/server";
import dotenv from "dotenv";

dotenv.config();

// Normalize Arabic text for city matching
function normalizeArabicText(text: string): string {
  return text
    .replace(/[\u0617-\u061A\u064B-\u065F]/g, "") // Remove diacritics
    .replace(/[\u0622\u0623\u0625]/g, "\u0627") // Normalize alef variants
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
}

// Calculate cosine similarity between two vectors (for fallback)
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    console.error("Invalid vectors for similarity calculation", {
      vecA: vecA ? vecA.length : "undefined",
      vecB: vecB ? vecB.length : "undefined",
    });
    return 0;
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const magnitudeProduct = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitudeProduct === 0) {
    console.error("Zero magnitude in similarity calculation");
    return 0;
  }

  return dotProduct / magnitudeProduct;
}

// Governorates and cities for filtering
export const governoratesWithCities: Record<string, string[]> = {
  القاهرة: [
    "15 مايو", "الازبكية", "البساتين", "التبين", "الخليفة", "الدراسة", "الدرب الاحمر",
    "الزاوية الحمراء", "الزيتون", "الساحل", "السلام", "السيدة زينب", "الشرابية",
    "مدينة الشروق", "الظاهر", "العتبة", "القاهرة الجديدة", "المرج", "عزبة النخل",
    "المطرية", "المعادى", "المعصرة", "المقطم", "المنيل", "الموسكى", "النزهة",
    "الوايلى", "باب الشعرية", "بولاق", "جاردن سيتى", "حدائق القبة", "حلوان",
    "دار السلام", "شبرا", "طره", "عابدين", "عباسية", "عين شمس", "مدينة نصر",
    "مصر الجديدة", "مصر القديمة", "منشية ناصر", "مدينة بدر", "مدينة العبور",
    "وسط البلد", "الزمالك", "قصر النيل", "الرحاب", "القطامية", "مدينتي",
    "روض الفرج", "شيراتون", "الجمالية", "العاشر من رمضان", "الحلمية",
    "النزهة الجديدة", "العاصمة الإدارية"
  ],
  // ... (other governorates and cities unchanged, omitted for brevity)
  الدقهلية: [
    "المنصورة", "طلخا", "ميت غمر", "دكرنس", "أجا", "منية النصر", "السنبلاوين",
    "الكردي", "بني عبيد", "المنزلة", "تمي الأمديد", "الجمالية", "شربين",
    "المطرية", "بلقاس", "ميت سلسيل", "جمصة", "محلة دمنة", "نبروه"
  ],
  // ... (remaining governorates)
};

// Generate city regex
const allCities = Object.values(governoratesWithCities).flat();
const cityRegex = new RegExp(`(${allCities.join('|')})`, 'iu');

const {
  PINECONE_API_KEY,
  PINECONE_INDEX_NAME,
  GOOGLE_API_KEY,
} = process.env;

console.log("Environment check:", {
  hasPineconeApiKey: !!PINECONE_API_KEY,
  hasPineconeIndexName: !!PINECONE_INDEX_NAME,
  hasGoogleApiKey: !!GOOGLE_API_KEY,
});

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY!,
});

const google = createGoogleGenerativeAI({
  apiKey: GOOGLE_API_KEY || "",
});

const MAX_CONTEXT_LENGTH = 30000;
const MIN_SIMILARITY = 0.7; // Temporarily set to 0 for debugging
const MIN_RATING = 2;
const EMBED_DIMENSION = 384; // Match all-MiniLM-L6-v2
const BYPASS_SIMILARITY = false; // Temporary flag for exact matches

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage || (!latestMessage.content && !latestMessage.parts)) {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    console.log(
      "Received message content:",
      JSON.stringify(latestMessage.content)
    );

    let textContent = "";
    if (typeof latestMessage.content === "string") {
      textContent = latestMessage.content;
    } else if (Array.isArray(latestMessage.content)) {
      textContent = latestMessage.content
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("\n");
    }

    if (!textContent) {
      textContent = "وصف الصورة";
    }

    console.log("Processing query:", textContent.substring(0, 50));

    // Extract city and craft from the message
    let clientCity: string | null = null;
    let craftType: string | null = null;
    const normalizedText = normalizeArabicText(textContent);
    const cityMatch = normalizedText.match(cityRegex);
    if (cityMatch) {
      clientCity = cityMatch[0];
      console.log(`Detected client city: ${clientCity}`);
    } else {
      console.log("No city detected in query. Normalized text:", normalizedText);
      console.log("City regex pattern:", cityRegex.source);
    }

    const craftMatch = normalizedText.match(/(سباك|نجار|كهربائي|حداد|فني تكييف|نقاش)/i);
    if (craftMatch) {
      craftType = craftMatch[0];
      console.log(`Detected craft type: ${craftType}`);
    } else {
      console.log("No craft type detected in query");
    }

    // Augment query for better embedding
    const augmentedQuery = clientCity && craftType
      ? `${craftType} في ${clientCity}`
      : craftType
      ? `${craftType} في مصر`
      : "سباك في مصر";
    console.log("Augmented query:", augmentedQuery);

    console.log("Generating embedding for query...");
    const embeddingResult = await generateSentenceEmbedding(augmentedQuery);
    const embeddingVector = embeddingResult.embedding;
    console.log("Embedding vector length:", embeddingVector.length);

    let docContext = "";
    let relevantDocsFound = false;
    let usedRelaxedFilters = false;

    try {
      console.log("Querying vector database...");
      const index = await getVectorIndex(EMBED_DIMENSION);
      console.log(`Using index: ${PINECONE_INDEX_NAME}`);

      const stats = await index.describeIndexStats();
      console.log("Index stats:", {
        totalVectorCount: stats.totalVectorCount,
        dimension: stats.dimension,
      });

      if (stats.totalVectorCount === 0) {
        console.warn("WARNING: No vectors found in index. Check data loading.");
        docContext = "لم يتم العثور على مستندات في قاعدة المعرفة.";
      } else {
        // First attempt: Strict filters (city, rating)
        let documents = await queryWithFilters(
          index,
          embeddingVector,
          clientCity,
          craftType,
          true
        );

        if (documents.length === 0) {
          console.log(
            "No documents found with strict filters. Trying relaxed filters..."
          );
          // Second attempt: Relaxed filters (ignore rating, keep city and craft)
          documents = await queryWithFilters(
            index,
            embeddingVector,
            clientCity,
            craftType,
            false
          );
          usedRelaxedFilters = true;
        }

        console.log(
          `Found ${documents.length} potential documents via vector search`
        );

        // Filter documents by similarity
        let relevantDocuments = documents;
        if (documents.length > 0) {
          relevantDocuments = documents
            .map((doc) => {
              if (doc._similarity === undefined && doc.$vector) {
                doc._similarity = calculateCosineSimilarity(
                  embeddingVector,
                  doc.$vector
                );
                console.log(
                  `Computed similarity for doc ${doc._id}: ${doc._similarity.toFixed(4)}`
                );
              }
              return doc;
            })
            .filter((doc) => {
              const hasVector = doc.$vector && Array.isArray(doc.$vector) && doc.$vector.length === EMBED_DIMENSION;
              console.log(`Document ${doc._id || 'unknown'}:`, {
                similarity: doc._similarity?.toFixed(4) || 'N/A',
                hasVector,
                vectorLength: doc.$vector?.length || 'N/A',
                cities: doc.cities || 'N/A',
                craft: doc.category || 'N/A',
                rating: doc.rating || 'N/A',
                text_preview: doc.text.substring(0, 100),
              });
              return BYPASS_SIMILARITY || (doc._similarity !== undefined && doc._similarity >= MIN_SIMILARITY);
            });
          console.log(
            `${relevantDocuments.length} documents meet similarity (${MIN_SIMILARITY}) threshold`
          );
        } else {
          console.log("No potential documents found.");
          relevantDocuments = [];
        }

        if (relevantDocuments.length > 0) {
          relevantDocsFound = true;
          console.log("First relevant document:", {
            text_preview: relevantDocuments[0].text.substring(0, 100),
            similarity: relevantDocuments[0]._similarity || "N/A",
            rating: relevantDocuments[0].rating || "N/A",
          });

          // Sort by rating if similarity is bypassed, else by similarity
          relevantDocuments.sort((a, b) => {
            if (BYPASS_SIMILARITY) {
              const ratingA = parseFloat(a.rating || '2');
              const ratingB = parseFloat(b.rating || '2');
              return ratingB - ratingA;
            }
            return (b._similarity || 0) - (a._similarity || 0);
          });

          docContext = relevantDocuments
            .map((doc, i) => {
              const similarity = doc._similarity
                ? `(مدى الصلة: ${doc._similarity.toFixed(2)})`
                : "(درجة الصلة غير متوفرة)";
              const title = doc.name || doc.text.split("\n")[0].substring(0, 50) + "...";
              const sourceId = doc._id || `doc-${i + 1}`;
              const sourceIdMetadata = `sourceId: ${sourceId}`;

              return `--- المستند ${i + 1}: ${title} ${similarity} ---\n${
                doc.text
              }\n${sourceIdMetadata}\n--- نهاية المستند ${i + 1} ---`;
            })
            .join("\n\n");

          if (docContext.length > MAX_CONTEXT_LENGTH) {
            console.log(
              `Context too large (${docContext.length} chars), truncating...`
            );
            docContext =
              docContext.substring(0, MAX_CONTEXT_LENGTH) +
              "\n[تم اقتطاع السياق بسبب الطول الزائد]";
          }

          console.log("Context length:", docContext.length);
        } else {
          console.warn("No documents meet the criteria for this query.");
          docContext = `لم يتم العثور على ${craftType} في ${
            clientCity || "المنطقة المطلوبة"
          }. جرب مدينة أخرى أو زيارة موقع حرفي لمزيد من الخيارات.`;
        }
      }
    } catch (error) {
      console.error("DB query error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      docContext = `حدث خطأ أثناء استرداد معلومات السياق: ${error instanceof Error ? error.message : String(error)}.`;
    }

    const systemPrompt = `
أنت مساعد ذكي ومتعاون خاص بموقع حرفي، هدفك الأساسي هو مساعدة المستخدمين في إيجاد حلول لمشاكلهم المنزلية أو اقتراح خدمات الحرفيين عند الحاجة.

### السياق المسترجع (قد يحتوي على معلومات أو قوائم حرفيين) ###
${docContext}
### نهاية السياق ###

🟢 تعليمات العمل:

1. **إذا طلب المستخدم حرفي محدد بشكل صريح** (مثل: "أحتاج سباك"، "أريد كهربائي"، "دلني على نجار"، "اقترح سباك"، "رشح نجار"):
    - **أولاً اسأل العميل عن المدينة التي تتواجد فيها المشكلة للبحث عن أقرب الحرفيين لسرعة حل المشكلة**
    - **ثانياً:** ابحث بدقة في \`السياق المسترجع\` عن **قائمة حرفيين** تطابق النوع المطلوب (مثل "${craftType}").
    - **إذا وجدت قائمة:** 
      - اكتب رسالة موجزة تقول أنك وجدت حرفيين مناسبين، مثل: "وجدت لك حرفيين متخصصين في ${craftType}${
        clientCity ? ` في ${clientCity}` : ""
      }${usedRelaxedFilters ? " (تم توسيع نطاق البحث لتضمين المزيد من الخيارات)" : ""}:"
      - ثم احتفظ بتنسيق المستندات الأصلي مع بداية كل مستند بـ "--- المستند" ونهايته بـ "--- نهاية المستند" لكي يتمكن نظام العرض من استخراج البيانات وعرضها في بطاقات
      - لا تكرر المعلومات التي ستظهر في البطاقات في نص رسالتك
    - **إذا لم تجد قائمة:** أخبر المستخدم بوضوح أنك لم تعثر على ${craftType} في ${
      clientCity || "المنطقة المطلوبة"
    }، ثم اقترح عليه استخدام موقع "حرفي" للبحث عن ${craftType} مناسب. مثال: "لم أجد ${craftType} في ${
      clientCity || "المنطقة المطلوبة"
    }. يمكنك زيارة موقع حرفي للعثور على ${craftType} في منطقتك مع تقييمات ومراجعات المستخدمين."

2. **إذا كان طلب المستخدم يتعلق بحل مشكلة منزلية أو استفسار عام** (ولم يطلب حرفي بشكل صريح):
    - حاول أولاً تقديم نصائح عملية وخطوات لمساعدته على حل المشكلة بنفسه.
    - استعن بـ \`السياق المسترجع\` إن كان يحتوي على معلومات مفيدة لدعم النصيحة.
    - **لا تقترح التواصل مع حرفي** إلا إذا:
        - تبين أن الحل يتطلب تدخلاً متخصصاً.
        - أو طلب المستخدم ذلك صراحة أثناء المحادثة.

3. **هام جداً: عند عرض الحرفيين:**
    - لا تكرر بيانات الحرفيين في نص رسالتك لأنها ستظهر في بطاقات منفصلة
    - اكتف بجملة مثل "إليك الحرفيين المتاحين${clientCity ? ` في ${clientCity}` : ""}:"
    - ثم ضع بيانات الحرفيين بالتنسيق المطلوب مع الحفاظ على العلامات التالية:
      - "--- المستند رقم:"
      - "sourceId: [رقم]"
      - "--- نهاية المستند رقم ---"

4. **اللغة:**
    - تحدث باللغة العربية الفصحى الواضحة.

5. **نقاط هامة:**
    - أنت مساعد ذكي خاص بموقع حرفي، إذا طلب العميل مكان آخر للبحث عن حرفيين فأنت لا تعرف سوى موقع حرفي وتقترحه عليه
    - إذا سأل أحد العملاء عن موقع حرفي، يجب أن يكون الرد بشكل مناسب ويبرز أهمية المنصة، مثال: منصة حرفي بتوصلك مباشرة بأفضل الحرفيين في منطقتك في مختلف التخصصات زي السباكة والكهرباء والنجارة وغيرهم. تقدر تستعرض تقييمات وتجارب كل المستخدمين سواء كانت إيجابية أو سلبية بكل شفافية، وتعرض مشكلتك عشان تستقبل عروض من أكتر من حرفي، وتفاوض على السعر براحتك، وتختار العرض الأنسب ليك. القرار في إيدك وإنت المتحكم في كل خطوة
    - أنت تمتلك القدرة على الوصول مباشرةً إلى قاعدة بيانات موقع حرفي للبحث عن حرفيين. لذلك، عندما يطلب منك العميل أن تبحث عن حرفيين، مثال: سباك، حداد، نجار .. إلخ يمكنك عرض بطاقات الحرفيين الموجودة لديك في نفس السياق

هدفك هو جعل تجربة المستخدم سهلة وفعالة، مع إعطاء الأولوية لمساعدته في اتخاذ قرار مناسب سواء عبر نصيحة عملية أو توصية بحرفي من السياق.
`;

    console.log("System prompt length:", systemPrompt.length);
    console.log(
      "System prompt preview (Arabic):",
      systemPrompt.substring(0, 250) + "..."
    );

    const debugInfo = relevantDocsFound
      ? `[DEBUG: Found ${
          docContext.split("--- المستند").length - 1
        } relevant documents${clientCity ? ` in ${clientCity}` : ""}${
          usedRelaxedFilters ? " (using relaxed filters)" : ""
        }]`
      : `[DEBUG: No relevant documents found in the database${
          clientCity ? ` for ${clientCity}` : ""
        }]`;

    const allMessages: Message[] = [
      {
        id: generateId(),
        role: "system",
        content: systemPrompt,
      },
      ...messages.map((m: any) => {
        if (typeof m.content === "string") {
          return {
            id: generateId(),
            role: m.role,
            content: m.content,
          };
        } else if (Array.isArray(m.content)) {
          return {
            id: generateId(),
            role: m.role,
            content: m.content
              .map((part: any) =>
                part.type === "text"
                  ? { type: "text", text: part.text }
                  : part.type === "image"
                  ? { type: "image", image: part.image }
                  : null
              )
              .filter((part: any) => part !== null),
          };
        }
        return {
          id: generateId(),
          role: m.role,
          content: "",
        };
      }),
    ];

    console.log("Generating AI response with Gemini...");
    console.log("Total messages:", allMessages.length);

    const result = await generateText({
      model: google("gemini-1.5-flash"),
      messages: allMessages,
      temperature: 0.5,
    });

    console.log("Backend response:", result.text);

    return NextResponse.json({
      id: generateId(),
      role: "assistant",
      content: result.text,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("API error:", error);
    console.error(
      error instanceof Error ? error.stack : "No stack trace available"
    );
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper function to query with filters
async function queryWithFilters(
  index: any,
  embeddingVector: number[],
  clientCity: string | null,
  craftType: string | null,
  applyRatingFilter: boolean
) {
  const filter: any = {};
  if (clientCity) {
    filter["cities"] = { $in: [clientCity] };
  }
  if (craftType) {
    filter["category"] = craftType;
  }

  console.log("Vector search params:", {
    vectorLength: embeddingVector.length,
    indexName: PINECONE_INDEX_NAME,
    cityFilter: clientCity || "none",
    craftFilter: craftType || "none",
    applyRatingFilter,
  });

  const queryResult = await index.query({
    vector: embeddingVector,
    topK: 15,
    includeMetadata: true,
    includeValues: true,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  let documents = queryResult.matches?.map((match: any) => ({
    _id: match.id,
    $vector: match.values,
    _similarity: match.score,
    text: match.metadata.description,
    name: match.metadata.name,
    category: match.metadata.category,
    cities: match.metadata.cities,
    rating: match.metadata.rating,
    keywords: match.metadata.keywords,
    image: match.metadata.image,
  })) || [];

  if (applyRatingFilter) {
    documents = documents.filter((doc: any) => {
      const rating = parseFloat(doc.rating || '2');
      console.log(`Rating check for doc ${doc._id || 'unknown'}:`, {
        rating,
        meetsRating: rating >= MIN_RATING,
      });
      return rating >= MIN_RATING;
    });
  }

  return documents;
}

// Helper function to initialize vector index
async function getVectorIndex(dimension: number): Promise<any> {
  try {
    const indexName = PINECONE_INDEX_NAME || "profiles";
    const indexList = await pinecone.listIndexes();
    const indexes = indexList.indexes || [];
    const exists = indexes.some((index) => index.name === indexName);

    if (!exists) {
      console.log(`Creating new index ${indexName}...`);
      await pinecone.createIndex({
        name: indexName,
        dimension,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1", // Adjust as needed
          },
        },
      });
      // Wait for index to be ready
      await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 seconds
    }

    return pinecone.Index(indexName);
  } catch (error) {
    console.error("Error initializing index:", error);
    throw new Error("Failed to initialize vector index");
  }
}