import { DataAPIClient } from "@datastax/astra-db-ts";
import { generateId, generateText, Message } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateSentenceEmbedding } from "@/lib/sentence-transformer-embedding";
import { NextResponse } from "next/server";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GOOGLE_API_KEY,
} = process.env;

console.log("Environment check:", {
  hasNamespace: !!ASTRA_DB_NAMESPACE,
  hasCollection: !!ASTRA_DB_COLLECTION,
  hasEndpoint: !!ASTRA_DB_API_ENDPOINT,
  hasToken: !!ASTRA_DB_APPLICATION_TOKEN,
  hasGoogleApiKey: !!GOOGLE_API_KEY,
});

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { keyspace: ASTRA_DB_NAMESPACE });

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || "",
});

const MAX_CONTEXT_LENGTH = 30000;
const MIN_SIMILARITY = 0.2;

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

    console.log("Generating embedding for query...");
    const embeddingResult = await generateSentenceEmbedding(textContent);
    const embeddingVector = embeddingResult.embedding;
    console.log("Embedding vector length:", embeddingVector.length);

    let docContext = "";
    let relevantDocsFound = false;
    try {
      console.log("Querying vector database...");
      const collection = db.collection(ASTRA_DB_COLLECTION!);
      console.log(`Using collection: ${ASTRA_DB_COLLECTION}`);

      const documentCheck = await collection.findOne({});
      if (!documentCheck) {
        console.warn(
          "WARNING: No documents found in collection. Check data loading."
        );
        docContext = "لم يتم العثور على مستندات في قاعدة المعرفة.";
      } else {
        
        const cursor = collection.find(null, {
          sort: { $vector: embeddingVector },
          limit: 15,
          includeSimilarity: true,
        });

        console.log("Vector search params:", {
          vectorLength: embeddingVector.length,
          collectionName: ASTRA_DB_COLLECTION,
        });
        const documents = await cursor.toArray();
        console.log(
          `Found ${documents.length} potential documents via vector search`
        );

        let relevantDocuments = documents;
        if (documents.length > 0 && documents[0]?._similarity !== undefined) {
          relevantDocuments = documents.filter(
            (doc) =>
              doc._similarity !== undefined && doc._similarity >= MIN_SIMILARITY
          );
          console.log(
            `${relevantDocuments.length} documents meet similarity threshold of ${MIN_SIMILARITY}`
          );
        } else if (documents.length > 0) {
          console.log(
            `Using all ${documents.length} found documents (similarity not available)`
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
          });

          docContext = relevantDocuments
            .map((doc, i) => {
              const similarity = doc._similarity
                ? `(مدى الصلة: ${doc._similarity.toFixed(2)})`
                : "(درجة الصلة غير متوفرة)";
              const title =
                doc.title || doc.text.split("\n")[0].substring(0, 50) + "...";
              const sourceId = doc.sourceId || doc._id || `doc-${i + 1}`;
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
          docContext =
            "لم يتم العثور على معلومات ذات صلة كافية في قاعدة المعرفة لهذا الاستعلام.";
        }
      }
    } catch (error) {
      console.error("DB query error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      docContext = "حدث خطأ أثناء استرداد معلومات السياق.";
    }

    const systemPrompt = `
أنت مساعد ذكي ومتعاون خاص بموقع حرفي، هدفك الأساسي هو مساعدة المستخدمين في إيجاد حلول لمشاكلهم المنزلية أو اقتراح خدمات الحرفيين عند الحاجة.

### السياق المسترجع (قد يحتوي على معلومات أو قوائم حرفيين) ###
${docContext}
### نهاية السياق ###

🟢 تعليمات العمل:

1. **إذا طلب المستخدم حرفي محدد بشكل صريح** (مثل: "أحتاج سباك"، "أريد كهربائي"، "دلني على نجار"):
    - **أولاً:** ابحث بدقة في \`السياق المسترجع\` عن **قائمة حرفيين** تطابق النوع المطلوب.
    - **إذا وجدت قائمة:** 
      - اكتب رسالة موجزة تقول أنك وجدت حرفيين مناسبين، مثل: "وجدت لك حرفيين متخصصين في النجارة:"
      - ثم احتفظ بتنسيق المستندات الأصلي مع بداية كل مستند بـ "--- المستند" ونهايته بـ "--- نهاية المستند" لكي يتمكن نظام العرض من استخراج البيانات وعرضها في بطاقات
      - لا تكرر المعلومات التي ستظهر في البطاقات في نص رسالتك
    - **إذا لم تجد قائمة:** أخبر المستخدم بوضوح أنك لم تعثر على قائمة لهذا النوع من الحرفيين في السياق الحالي، ثم اقترح عليه استخدام موقعنا "حرفي" للبحث عن حرفيين مناسبين.

2. **إذا كان طلب المستخدم يتعلق بحل مشكلة منزلية أو استفسار عام** (ولم يطلب حرفي بشكل صريح):
    - حاول أولاً تقديم نصائح عملية وخطوات لمساعدته على حل المشكلة بنفسه.
    - استعن بـ \`السياق المسترجع\` إن كان يحتوي على معلومات مفيدة لدعم النصيحة.
    - **لا تقترح التواصل مع حرفي** إلا إذا:
        - تبين أن الحل يتطلب تدخلاً متخصصاً.
        - أو طلب المستخدم ذلك صراحة أثناء المحادثة.

3. **هام جداً: عند عرض الحرفيين:**
    - لا تكرر بيانات الحرفيين في نص رسالتك لأنها ستظهر في بطاقات منفصلة
    - اكتف بجملة مثل "إليك الحرفيين المتاحين:"
    - ثم ضع بيانات الحرفيين بالتنسيق المطلوب مع الحفاظ على العلامات التالية:
      - "--- المستند رقم:"
      - "sourceId: [رقم]"
      - "--- نهاية المستند رقم ---"

4. **اللغة:**
    - تحدث باللغة العربية الفصحى الواضحة.

5. **:نقاط هامة**
    - انت مساعد ذكي خاص بموقع حرفي، اذا طلب العميل مكان اخر للبحث عن حرفيين فأنت لا تعرف سوى موقع حرفي وتقترحه عليه
    - اذا سأل احد العملاء عن موقع حرفي، يجب ان يكون الرد بشكل مناسب ويبرز أهمية المنصة، مثال: منصة حرفي بتوصلك مباشرة بأفضل الحرفيين في منطقتك في مختلف التخصصات زي السباكة والكهرباء والنجارة وغيرهم. تقدر تستعرض تقييمات وتجارب كل المستخدمين سواء كانت إيجابية أو سلبية بكل شفافية، وتعرض مشكلتك عشان تستقبل عروض من أكتر من حرفي، وتفاوض على السعر براحتك، وتختار العرض الأنسب ليك. القرار في إيدك وإنت المتحكم في كل خطوة  


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
        } relevant documents]`
      : "[DEBUG: No relevant documents found in the database]";

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
