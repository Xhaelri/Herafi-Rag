import { Pinecone } from "@pinecone-database/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { generateId, generateText, Message } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateSentenceEmbedding } from "@/lib/AI/sentence-transformer-embedding";
import { NextResponse } from "next/server";
import dotenv from "dotenv";

dotenv.config();

function normalizeArabicText(text: string): string {
  return text
    .replace(/[\u0617-\u061A\u064B-\u065F]/g, "") 
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\s+/g, " ") 
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

export const governoratesWithCities: Record<string, string[]> = {
  القاهرة: [
    "15 مايو",
    "الازبكية",
    "البساتين",
    "التبين",
    "الخليفة",
    "الدراسة",
    "الدرب الاحمر",
    "الزاوية الحمراء",
    "الزيتون",
    "الساحل",
    "السلام",
    "السيدة زينب",
    "الشرابية",
    "مدينة الشروق",
    "الظاهر",
    "العتبة",
    "القاهرة الجديدة",
    "المرج",
    "عزبة النخل",
    "المطرية",
    "المعادى",
    "المعصرة",
    "المقطم",
    "المنيل",
    "الموسكى",
    "النزهة",
    "الوايلى",
    "باب الشعرية",
    "بولاق",
    "جاردن سيتى",
    "حدائق القبة",
    "حلوان",
    "دار السلام",
    "شبرا",
    "طره",
    "عابدين",
    "عباسية",
    "عين شمس",
    "مدينة نصر",
    "مصر الجديدة",
    "مصر القديمة",
    "منشية ناصر",
    "مدينة بدر",
    "مدينة العبور",
    "وسط البلد",
    "الزمالك",
    "قصر النيل",
    "الرحاب",
    "القطامية",
    "مدينتي",
    "روض الفرج",
    "شيراتون",
    "الجمالية",
    "العاشر من رمضان",
    "الحلمية",
    "النزهة الجديدة",
    "العاصمة الإدارية",
  ],
  الجيزة: [
    "الجيزة",
    "السادس من أكتوبر",
    "الشيخ زايد",
    "الحوامدية",
    "البدرشين",
    "الصف",
    "أطفيح",
    "العياط",
    "الباويطي",
    "منشأة القناطر",
    "أوسيم",
    "كرداسة",
    "أبو النمر",
    "كفر غطاطي",
    "منشأة البكاري",
    "الدقى",
    "العجوزة",
    "الهرم",
    "الوراق",
    "امبابة",
    "بولاق الدكرور",
    "الواحات البحرية",
    "العمرانية",
    "المنيب",
    "بين السرايات",
    "الكيت كات",
    "المهندسين",
    "فيصل",
    "أبو رواش",
    "حدائق الأهرام",
    "الحرانية",
    "حدائق اكتوبر",
    "صفط اللبن",
    "القرية الذكية",
    "ارض اللواء",
  ],
  الإسكندرية: [
    "ابو قير",
    "الابراهيمية",
    "الأزاريطة",
    "الانفوشى",
    "الدخيلة",
    "السيوف",
    "العامرية",
    "اللبان",
    "المفروزة",
    "المنتزه",
    "المنشية",
    "الناصرية",
    "امبروزو",
    "باب شرق",
    "برج العرب",
    "ستانلى",
    "سموحة",
    "سيدى بشر",
    "شدس",
    "غيط العنب",
    "فلمينج",
    "فيكتوريا",
    "كامب شيزار",
    "كرموز",
    "محطة الرمل",
    "مينا البصل",
    "العصافرة",
    "العجمي",
    "بكوس",
    "بولكلي",
    "كليوباترا",
    "جليم",
    "المعمورة",
    "المندرة",
    "محرم بك",
    "الشاطبي",
    "سيدي جابر",
    "الساحل الشمالي",
    "الحضرة",
    "العطارين",
    "سيدي كرير",
    "الجمرك",
    "المكس",
    "مارينا",
  ],
  الدقهلية: [
    "المنصورة",
    "طلخا",
    "ميت غمر",
    "دكرنس",
    "أجا",
    "منية النصر",
    "السنبلاوين",
    "الكردي",
    "بني عبيد",
    "المنزلة",
    "تمي الأمديد",
    "الجمالية",
    "شربين",
    "المطرية",
    "بلقاس",
    "ميت سلسيل",
    "جمصة",
    "محلة دمنة",
    "نبروه",
  ],
  "البحر الأحمر": [
    "الغردقة",
    "رأس غارب",
    "سفاجا",
    "القصير",
    "مرسى علم",
    "الشلاتين",
    "حلايب",
    "الدهار",
  ],
  البحيرة: [
    "دمنهور",
    "كفر الدوار",
    "رشيد",
    "إدكو",
    "أبو المطامير",
    "أبو حمص",
    "الدلنجات",
    "المحمودية",
    "الرحمانية",
    "إيتاي البارود",
    "حوش عيسى",
    "شبراخيت",
    "كوم حمادة",
    "بدر",
    "وادي النطرون",
    "النوبارية الجديدة",
    "النوبارية",
  ],
  الفيوم: [
    "الفيوم",
    "الفيوم الجديدة",
    "طامية",
    "سنورس",
    "إطسا",
    "إبشواي",
    "يوسف الصديق",
    "الحادقة",
    "اطسا",
    "الجامعة",
    "السيالة",
  ],
  الغربية: [
    "طنطا",
    "المحلة الكبرى",
    "كفر الزيات",
    "زفتى",
    "السنطة",
    "قطور",
    "بسيون",
    "سمنود",
  ],
  الإسماعلية: [
    "الإسماعلية",
    "فايد",
    "القنطرة شرق",
    "القنطرة غرب",
    "التل الكبير",
    "أبو صوير",
    "القصاصين الجديدة",
    "نفيشة",
    "الشيخ زايد",
  ],
  المنوفية: ["شبين الكوم", "مدينة السادات", "منوف"],
  المنيا: [
    "المنيا",
    "المنيا الجديدة",
    "العدوة",
    "مغاغة",
    "بني مزار",
    "مطاي",
    "سمالوط",
    "المدينة الفكرية",
    "ملوي",
    "دير مواس",
    "ابو قرقاص",
    "ارض سلطان",
  ],
  القليوبية: [
    "بنها",
    "قليوب",
    "شبرا الخيمة",
    "القناطر الخيرية",
    "الخانكة",
    "كفر شكر",
    "طوخ",
    "قها",
    "العبور",
    "الخصوص",
    "شبين القناطر",
    "مسطرد",
  ],
  "الوادي الجديد": ["الخارجة", "باريس", "موط", "الفرافرة", "بلاط", "الداخلة"],
  السويس: ["السويس", "الجناين", "عتاقة", "العين السخنة", "فيصل"],
  أسوان: [
    "أسوان",
    "أسوان الجديدة",
    "دراو",
    "كوم أمبو",
    "نصر النوبة",
    "كلابشة",
    "إدفو",
    "الرديسية",
    "البصيلية",
    "السباعية",
    "ابوسمبل السياحية",
    "مرسى علم",
  ],
  أسيوط: [
    "أسيوط",
    "أسيوط الجديدة",
    "ديروط",
    "منفلوط",
    "القوصية",
    "أبنوب",
    "أبو تيج",
    "الغنايم",
    "ساحل سليم",
    "البداري",
    "صدفا",
  ],
  "بني سويف": [
    "بني سويف",
    "بني سويف الجديدة",
    "الواسطى",
    "ناصر",
    "إهناسيا",
    "ببا",
    "الفشن",
    "سمسطا",
    "الاباصيرى",
    "مقبل",
  ],
  بورسعيد: [
    "بورسعيد",
    "بورفؤاد",
    "العرب",
    "حى الزهور",
    "حى الشرق",
    "حى الضواحى",
    "حى المناخ",
    "حى مبارك",
  ],
  دمياط: [
    "دمياط",
    "دمياط الجديدة",
    "رأس البر",
    "فارسكور",
    "الزرقا",
    "السرو",
    "الروضة",
    "كفر البطيخ",
    "ميت أبو غالب",
    "كفر سعد",
  ],
  الشرقية: [
    "الزقازيق",
    "العاشر من رمضان",
    "منيا القمح",
    "بلبيس",
    "مشتول السوق",
    "القنايات",
    "أبو حماد",
    "القرين",
    "ههيا",
    "أبو كبير",
    "فاقوس",
    "الصالحية الجديدة",
    "الإبراهيمية",
    "ديرب نجم",
    "كفر صقر",
    "أولاد صقر",
    "الحسينية",
    "صان الحجر القبلية",
    "منشأة أبو عمر",
  ],
  "سيناء الجنوبية": [
    "الطور",
    "شرم الشيخ",
    "دهب",
    "نويبع",
    "طابا",
    "سانت كاترين",
    "أبو رديس",
    "أبو زنيمة",
    "رأس سدر",
  ],
  "كفر الشيخ": [
    "كفر الشيخ",
    "وسط البلد كفر الشيخ",
    "دسوق",
    "فوه",
    "مطوبس",
    "برج البرلس",
    "بلطيم",
    "مصيف بلطيم",
    "الحامول",
    "بيلا",
    "الرياض",
    "سيدي سالم",
    "قلين",
    "سيدي غازي",
  ],
  "مرسى مطروح": [
    "مرسى مطروح",
    "الحمام",
    "العلمين",
    "الضبعة",
    "النجيلة",
    "سيدي براني",
    "السلوم",
    "سيوة",
    "مارينا",
    "الساحل الشمالى",
  ],
  الأقصر: [
    "الأقصر",
    "الأقصر الجديدة",
    "إسنا",
    "طيبة الجديدة",
    "الزينية",
    "البياضية",
    "القرنة",
    "أرمنت",
    "الطود",
  ],
  قنا: [
    "قنا",
    "قنا الجديدة",
    "ابو طشت",
    "نجع حمادي",
    "دشنا",
    "الوقف",
    "قفط",
    "نقادة",
    "فرشوط",
    "قوص",
  ],
  "شمال سيناء": ["العريش", "الشيخ زويد", "نخل", "رفح", "بئر العبد", "الحسنة"],
  سوهاج: [
    "سوهاج",
    "سوهاج الجديدة",
    "أخميم",
    "أخميم الجديدة",
    "البلينا",
    "المراغة",
    "المنشأة",
    "دار السلام",
    "جرجا",
    "جهينة الغربية",
    "ساقلته",
    "طما",
    "طهطا",
    "الكوثر",
  ],
};

const allCities = Object.values(governoratesWithCities)
  .flat()
  .map((city) => normalizeArabicText(city)); 
console.log("All normalized cities:", allCities); 
const escapedCities = allCities.map(escapeRegExp); 
const cityRegex = new RegExp(
  `(^|\\s)(${escapedCities.join("|")})(\\s|$)`,
  "iu"
);
console.log("City regex pattern:", cityRegex.source);

const { PINECONE_API_KEY, PINECONE_INDEX_NAME, GOOGLE_API_KEY } = process.env;

console.log("Environment check:", {
  hasPineconeApiKey: !!PINECONE_API_KEY,
  hasPineconeIndexName: !!PINECONE_INDEX_NAME,
  hasPineconeApiKey: !!PINECONE_API_KEY,
  hasPineconeIndexName: !!PINECONE_INDEX_NAME,
  hasGoogleApiKey: !!GOOGLE_API_KEY,
});

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY!,
});
// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY!,
});

const google = createGoogleGenerativeAI({
  apiKey: GOOGLE_API_KEY || "",
  apiKey: GOOGLE_API_KEY || "",
});

const MAX_CONTEXT_LENGTH = 30000;
const MIN_SIMILARITY = 0.3;
const MIN_RATING = 0;
const EMBED_DIMENSION = 384;
const BYPASS_SIMILARITY = false;
const MIN_SIMILARITY = 0.3;
const MIN_RATING = 0;
const EMBED_DIMENSION = 384;
const BYPASS_SIMILARITY = false;

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

    let clientCity: string | null = null;
    let craftType: string | null = null;
    const normalizedText = normalizeArabicText(textContent);
    console.log("Normalized text for regex:", normalizedText); 
    const cityMatch = normalizedText.match(cityRegex);
    if (cityMatch) {
      clientCity = cityMatch[2]; 
      console.log(`Detected client city: ${clientCity}`);
      const originalCity = Object.values(governoratesWithCities)
        .flat()
        .find((city) => normalizeArabicText(city) === clientCity);
      clientCity = originalCity || clientCity;
      console.log(`Mapped to original city: ${clientCity}`);
    } else {
      console.log(
        "No city detected in query. Normalized text:",
        normalizedText
      );
      console.log("Normalized city list sample:", allCities.slice(0, 10));
      console.log("City regex pattern:", cityRegex.source);
      const fallbackRegex = /(^|\s)اجا(\s|$)/iu;
      const fallbackMatch = normalizedText.match(fallbackRegex);
      console.log("Fallback regex match for 'اجا':", fallbackMatch);
    }

    const craftMatch = normalizedText.match(
      /(سباك|نجار|كهربائي|حداد|فني تكييف|نقاش)/i
    );
    if (craftMatch) {
      craftType = craftMatch[0];
      console.log(`Detected craft type: ${craftType}`);
    } else {
      console.log("No craft type detected in query");
    }

    let augmentedQuery: string;
    if (clientCity && craftType) {
      augmentedQuery = `${craftType} في ${clientCity}`;
    } else if (clientCity) {
      augmentedQuery = `حرفيين في ${clientCity}`;
      console.log("City-only query detected, searching for all craftsmen");
    } else if (craftType) {
      augmentedQuery = `${craftType} في مصر`;
    } else {
      augmentedQuery = "حرفيين في مصر";
    }
    console.log("Augmented query:", augmentedQuery);

    console.log("Generating embedding for query...");
    const embeddingResult = await generateSentenceEmbedding(augmentedQuery);
    const embeddingResult = await generateSentenceEmbedding(augmentedQuery);
    const embeddingVector = embeddingResult.embedding;
    console.log("Embedding vector length:", embeddingVector.length);

    let docContext = "";
    let relevantDocsFound = false;
    let usedRelaxedFilters = false;

    let usedRelaxedFilters = false;

    try {
      console.log("Querying vector database...");
      const index = await getVectorIndex(EMBED_DIMENSION);
      console.log(`Using index: ${PINECONE_INDEX_NAME}`);
      const index = await getVectorIndex(EMBED_DIMENSION);
      console.log(`Using index: ${PINECONE_INDEX_NAME}`);

      const stats = await index.describeIndexStats();
      console.log("Index stats:", {
        totalVectorCount: stats.totalVectorCount,
        dimension: stats.dimension,
      });

      if (stats.totalVectorCount === 0) {
        console.warn("WARNING: No vectors found in index. Check data loading.");
      const stats = await index.describeIndexStats();
      console.log("Index stats:", {
        totalVectorCount: stats.totalVectorCount,
        dimension: stats.dimension,
      });

      if (stats.totalVectorCount === 0) {
        console.warn("WARNING: No vectors found in index. Check data loading.");
        docContext = "لم يتم العثور على مستندات في قاعدة المعرفة.";
      } else {
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
                  `Computed similarity for doc ${
                    doc._id
                  }: ${doc._similarity.toFixed(4)}`
                );
              }
              return doc;
            })
            .filter((doc) => {
              const hasVector =
                doc.$vector &&
                Array.isArray(doc.$vector) &&
                doc.$vector.length === EMBED_DIMENSION;
              console.log(`Document ${doc._id || "unknown"}:`, {
                id: doc.id,
                similarity: doc._similarity?.toFixed(4) || "N/A",
                hasVector,
                vectorLength: doc.$vector?.length || "N/A",
                cities: doc.cities || "N/A",
                craft: doc.category || "N/A",
                rating: doc.rating || "N/A",
                text_preview: doc.text.substring(0, 100),
              });
              return (
                BYPASS_SIMILARITY ||
                (doc._similarity !== undefined &&
                  doc._similarity >= MIN_SIMILARITY)
              );
            });
          console.log(
            `${relevantDocuments.length} documents meet similarity (${MIN_SIMILARITY}) threshold`
            `${relevantDocuments.length} documents meet similarity (${MIN_SIMILARITY}) threshold`
          );
        } else {
          console.log("No potential documents found.");
          relevantDocuments = [];
        }

        if (relevantDocuments.length > 0) {
          relevantDocsFound = true;
          console.log("First relevant document:", {
            id: relevantDocuments[0].id,
            text_preview: relevantDocuments[0].text.substring(0, 100),
            similarity: relevantDocuments[0]._similarity || "N/A",
            rating: relevantDocuments[0].rating || "N/A",
          });

          // Sort by rating if similarity is bypassed, else by similarity
          relevantDocuments.sort((a, b) => {
            if (BYPASS_SIMILARITY) {
              const ratingA = parseFloat(a.rating || "2");
              const ratingB = parseFloat(b.rating || "2");
              return ratingB - ratingA;
            }
            return (b._similarity || 0) - (a._similarity || 0);
            rating: relevantDocuments[0].rating || "N/A",
          });

          // Sort by rating if similarity is bypassed, else by similarity
          relevantDocuments.sort((a, b) => {
            if (BYPASS_SIMILARITY) {
              const ratingA = parseFloat(a.rating || "2");
              const ratingB = parseFloat(b.rating || "2");
              return ratingB - ratingA;
            }
            return (b._similarity || 0) - (a._similarity || 0);
          });

          docContext = relevantDocuments
            .map((doc, i) => {
              const similarity = doc._similarity
                ? `(مدى الصلة: ${doc._similarity.toFixed(2)})`
                : "(درجة الصلة غير متوفرة)";
              const title =
                doc.name || doc.text.split("\n")[0].substring(0, 50) + "...";
              const sourceId = doc._id || `doc-${i + 1}`;
                doc.name || doc.text.split("\n")[0].substring(0, 50) + "...";
              const sourceId = doc._id || `doc-${i + 1}`;
              const sourceIdMetadata = `sourceId: ${sourceId}`;
              const idMetadata = `id: ${doc.id}`;
              console.log(`Document a7a ${doc.id} (${sourceId}):`);
              return `--- المستند ${i + 1}: ${title} ${similarity} ---\n${
                doc.text
              }\n${idMetadata}\n${sourceIdMetadata}\n--- نهاية المستند ${
                i + 1
              } ---`;
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
          docContext = `لم يتم العثور على ${craftType || "حرفيين"} في ${
            clientCity || "المنطقة المطلوبة"
          }. جرب مدينة أخرى أو زيارة موقع حرفي لمزيد من الخيارات.`;
          docContext = `لم يتم العثور على ${craftType || "حرفيين"} في ${
            clientCity || "المنطقة المطلوبة"
          }. جرب مدينة أخرى أو زيارة موقع حرفي لمزيد من الخيارات.`;
        }
      }
    } catch (error) {
      console.error("DB query error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      docContext = `حدث خطأ أثناء استرداد معلومات السياق: ${
        error instanceof Error ? error.message : String(error)
      }.`;
      docContext = `حدث خطأ أثناء استرداد معلومات السياق: ${
        error instanceof Error ? error.message : String(error)
      }.`;
    }

    const systemPrompt = `
أنت مساعد ذكي ومتعاون خاص بموقع حرفي، هدفك الأساسي هو مساعدة المستخدمين في إيجاد حلول لمشاكلهم المنزلية أو اقتراح خدمات الحرفيين عند الحاجة.

### السياق المسترجع (قد يحتوي على معلومات أو قوائم حرفيين) ###
${docContext}
### نهاية السياق ###

🟢 تعليمات العمل:

1. **إذا طلب المستخدم حرفي محدد بشكل صريح** (مثل: "حداد"، "سباك"، "كهربائي"، "أحتاج سباك"، "أريد كهربائي"، "دلني على نجار"، "اقترح سباك"، "رشح نجار"):
    - **أولاً اسأل العميل عن المدينة التي تتواجد فيها المشكلة للبحث عن أقرب الحرفيين لسرعة حل المشكلة** (إلا إذا ذكر المدينة في الطلب).
    - **ثانياً:** ابحث بدقة في \`السياق المسترجع\` عن **قائمة حرفيين** تطابق النوع المطلوب (مثل "${craftType}").
1. **إذا طلب المستخدم حرفي محدد بشكل صريح** (مثل: "حداد"، "سباك"، "كهربائي"، "أحتاج سباك"، "أريد كهربائي"، "دلني على نجار"، "اقترح سباك"، "رشح نجار"):
    - **أولاً اسأل العميل عن المدينة التي تتواجد فيها المشكلة للبحث عن أقرب الحرفيين لسرعة حل المشكلة** (إلا إذا ذكر المدينة في الطلب).
    - **ثانياً:** ابحث بدقة في \`السياق المسترجع\` عن **قائمة حرفيين** تطابق النوع المطلوب (مثل "${craftType}").
    - **إذا وجدت قائمة:** 
      - اكتب رسالة موجزة تقول أنك وجدت حرفيين مناسبين، مثل: "وجدت لك حرفيين متخصصين في ${craftType}${
      clientCity ? ` في ${clientCity}` : ""
    }${
      usedRelaxedFilters
        ? " (تم توسيع نطاق البحث لتضمين المزيد من الخيارات)"
        : ""
    }:"
      - اكتب رسالة موجزة تقول أنك وجدت حرفيين مناسبين، مثل: "وجدت لك حرفيين متخصصين في ${craftType}${
      clientCity ? ` في ${clientCity}` : ""
    }${
      usedRelaxedFilters
        ? " (تم توسيع نطاق البحث لتضمين المزيد من الخيارات)"
        : ""
    }:"
      - ثم احتفظ بتنسيق المستندات الأصلي مع بداية كل مستند بـ "--- المستند" ونهايته بـ "--- نهاية المستند" لكي يتمكن نظام العرض من استخراج البيانات وعرضها في بطاقات
      - لا تكرر المعلومات التي ستظهر في البطاقات في نص رسالتك
    - **إذا لم تجد قائمة:** أخبر المستخدم بوضوح أنك لم تعثر على ${craftType} في ${
      clientCity || "المنطقة المطلوبة"
    }، ثم اقترح عليه استخدام موقع "حرفي" للبحث عن ${craftType} مناسب. مثال: "لم أجد ${craftType} في ${
      clientCity || "المنطقة المطلوبة"
    }. يمكنك زيارة موقع حرفي للعثور على ${craftType} في منطقتك مع تقييمات ومراجعات المستخدمين."

2. **إذا ذكر المستخدم مدينة فقط دون تحديد نوع الحرفي** (مثل: "طلخا"):
    - إذا وجدت قائمة حرفيين في المدينة في \`السياق المسترجع\`:
      - اكتب رسالة موجزة تقول: "وجدت لك مجموعة من الحرفيين المتاحين في ${clientCity}:"
      - ثم احتفظ بتنسيق المستندات الأصلي مع بداية كل مستند بـ "--- المستند" ونهايته بـ "--- نهاية المستند" لعرض جميع الحرفيين في بطاقات.
      - لا تكرر معلومات الحرفيين في نص رسالتك.
    - إذا لم تجد قائمة حرفيين في المدينة:
      - أخبر المستخدم: "لم أجد حرفيين في ${clientCity}. يمكنك زيارة موقع حرفي للعثور على حرفيين في منطقتك مع تقييمات ومراجعات المستخدمين."
    -  إذا كان السياق يحتوي على حرفيين ولكن المستخدم لم يحدد نوع الحرفي، لا تفترض نوعًا معينًا (مثل "سباك")،  اذا كان غير واضح من السياق ما الحرفة التي يحتاجها المستخدم، فاسأل المستخدم عن نوع الحرفي المطلوب.
    - **إذا لم تجد قائمة:** أخبر المستخدم بوضوح أنك لم تعثر على ${craftType} في ${
      clientCity || "المنطقة المطلوبة"
    }، ثم اقترح عليه استخدام موقع "حرفي" للبحث عن ${craftType} مناسب. مثال: "لم أجد ${craftType} في ${
      clientCity || "المنطقة المطلوبة"
    }. يمكنك زيارة موقع حرفي للعثور على ${craftType} في منطقتك مع تقييمات ومراجعات المستخدمين."

2. **إذا ذكر المستخدم مدينة فقط دون تحديد نوع الحرفي** (مثل: "طلخا"):
    - إذا وجدت قائمة حرفيين في المدينة في \`السياق المسترجع\`:
      - اكتب رسالة موجزة تقول: "وجدت لك مجموعة من الحرفيين المتاحين في ${clientCity}:"
      - ثم احتفظ بتنسيق المستندات الأصلي مع بداية كل مستند بـ "--- المستند" ونهايته بـ "--- نهاية المستند" لعرض جميع الحرفيين في بطاقات.
      - لا تكرر معلومات الحرفيين في نص رسالتك.
    - إذا لم تجد قائمة حرفيين في المدينة:
      - أخبر المستخدم: "لم أجد حرفيين في ${clientCity}. يمكنك زيارة موقع حرفي للعثور على حرفيين في منطقتك مع تقييمات ومراجعات المستخدمين."
    -  إذا كان السياق يحتوي على حرفيين ولكن المستخدم لم يحدد نوع الحرفي، لا تفترض نوعًا معينًا (مثل "سباك")،  اذا كان غير واضح من السياق ما الحرفة التي يحتاجها المستخدم، فاسأل المستخدم عن نوع الحرفي المطلوب.

3. **إذا كان طلب المستخدم يتعلق بحل مشكلة منزلية أو استفسار عام** (ولم يطلب حرفي بشكل صريح):
3. **إذا كان طلب المستخدم يتعلق بحل مشكلة منزلية أو استفسار عام** (ولم يطلب حرفي بشكل صريح):
    - حاول أولاً تقديم نصائح عملية وخطوات لمساعدته على حل المشكلة بنفسه.
    - استعن بـ \`السياق المسترجع\` إن كان يحتوي على معلومات مفيدة لدعم النصيحة.
    - **لا تقترح التواصل مع حرفي** إلا إذا:
        - تبين أن الحل يتطلب تدخلاً متخصصاً.
        - أو طلب المستخدم ذلك صراحة أثناء المحادثة.

4. **هام جداً: عند عرض الحرفيين:**
    - لا تكرر بيانات الحرفيين في نص رسالتك لأنها ستظهر في بطاقات منفصلة.
    - اكتف بجملة مثل "إليك قائمة بال${craftType} المتوفرين في ${clientCity || ""}:"
    - ثم أعد إنتاج بيانات الحرفيين من السياق المسترجع بالكامل، مع الحفاظ على جميع الحقول بالضبط كما هي، بما في ذلك:
      - "--- المستند رقم:"
      - جميع الحقول مثل "اسم الحرفي:"، "المهنة:"، إلخ.
      - "id: [رقم]" (مثل "id: 2")
      - "sourceId: [معرف]" (مثل "sourceId: 5eb679c5-3cac-4032-9f5b-7890bc9a63c9")
      - "--- نهاية المستند رقم ---"
    - **تحذير هام:** يجب أن يحتوي كل مستند على "id:" و"sourceId:" في النهاية. لا تحذف، تعدل، أو تعيد صياغة أي حقل. إذا حذفت "id:"، سيؤدي ذلك إلى روابط مكسورة في النظام.
    
5. **اللغة:**
    - تحدث باللغة العربية الفصحى الواضحة.

6. **نقاط هامة:**
    - أنت مساعد ذكي خاص بموقع حرفي، إذا طلب العميل مكان آخر للبحث عن حرفيين فأنت لا تعرف سوى موقع حرفي وتقترحه عليه
    - إذا سأل أحد العملاء عن موقع حرفي، يجب أن يكون الرد بشكل مناسب ويبرز أهمية المنصة، مثال: منصة حرفي بتوصلك مباشرة بأفضل الحرفيين في منطقتك في مختلف التخصصات زي السباكة والكهرباء والنجارة وغيرهم. تقدر تستعرض تقييمات وتجارب كل المستخدمين سواء كانت إيجابية أو سلبية بكل شفافية، وتعرض مشكلتك عشان تستقبل عروض من أكتر من حرفي، وتفاوض على السعر براحتك، وتختار العرض الأنسب ليك. القرار في إيدك وإنت المتحكم في كل خطوة
    - أنت تمتلك القدرة على الوصول مباشرةً إلى قاعدة بيانات موقع حرفي للبحث عن حرفيين. لذلك، عندما يطلب منك العميل أن تبحث عن حرفيين، مثال: سباك، حداد، نجار .. إلخ يمكنك عرض بطاقات الحرفيين الموجودة لديك في نفس السياق
6. **نقاط هامة:**
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

  let documents =
    queryResult.matches?.map((match: any) => ({
      id: match.metadata.id,
      _id: match.id,
      craftsmanId: match.metadata.id,
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
      const rating = parseFloat(doc.rating || "2");
      console.log(`Rating check for doc ${doc._id || "unknown"}:`, {
        rating,
        meetsRating: rating >= MIN_RATING,
      });
      return rating >= MIN_RATING;
    });
  }

  return documents;
}

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
            region: "us-east-1",
          },
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }

    return pinecone.Index(indexName);
  } catch (error) {
    console.error("Error initializing index:", error);
    throw new Error("Failed to initialize vector index");
  }
}
