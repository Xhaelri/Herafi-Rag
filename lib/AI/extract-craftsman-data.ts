import { Craftsman } from "@/typs";

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

export function messageContainsCraftsmanData(text: string): boolean {
  return text.includes("--- المستند") && text.includes("sourceId:");
}

export function extractCraftsmanData(text: string): Craftsman[] {
  const craftsmen: Craftsman[] = [];

  const documentRegex =
    /--- المستند \d+.*?([\s\S]*?)--- نهاية المستند \d+ ---/g;
  let match;

  while ((match = documentRegex.exec(text)) !== null) {
    const docContent = match[1];
    if (!docContent || !docContent.trim()) {
      console.warn("Skipping empty document block");
      continue;
    }

    try {
      console.log("Raw docContent:", docContent);

      const fields = [
        { key: "name", label: "اسم الحرفي:" },
        { key: "craft", label: "المهنة:" },
        { key: "addressRaw", label: "العنوان:" },
        { key: "cities", label: "المدن:" },
        { key: "ratingText", label: "التقييم:" },
        { key: "completedJobsText", label: "الوظائف المنجزة:" },
        { key: "activeJobsText", label: "الوظائف النشطة:" },
        { key: "description", label: "الوصف:" },
        { key: "statusText", label: "الحالة:" },
        { key: "image", label: "رابط الصورة:" },
        { key: "sourceId", label: "sourceId:" },
        { key: "id", label: "id:" },
      ];

      const extractedRawData: Record<string, string> = {};
      for (let i = 0; i < fields.length; i++) {
        const currentField = fields[i];
        const nextFieldLabel = i + 1 < fields.length ? fields[i + 1].label : null;

        const fieldRegex = new RegExp(
          `${escapeRegExp(currentField.label)}\\s*([^\\n]*?)\\s*(?=${
            nextFieldLabel ? escapeRegExp(nextFieldLabel) : "$|\\n"
          })`,
          "i"
        );
        const fieldMatch = docContent.match(fieldRegex);

        if (fieldMatch && fieldMatch[1]) {
          const rawValue = fieldMatch[1].trim();
          if (rawValue) {
            extractedRawData[currentField.key] = rawValue;
          }
        }
      }

      console.log("Extracted raw data:", extractedRawData); 

      let id = extractedRawData.id;
      if (!id) {
        const idPatterns = [
          /id:\s*(\d+)/i,
          /رقم الحرفي:\s*(\d+)/,
          /رقم المعرف:\s*(\d+)/,
          /ID:\s*(\d+)/i,
        ];
        for (const pattern of idPatterns) {
          const idMatch = docContent.match(pattern);
          if (idMatch) {
            id = idMatch[1];
            console.log(`Found id with pattern ${pattern}:`, id);
            break;
          }
        }
      }

      if (!id) {
        const idMatch = docContent.match(/id:\s*(\d+)/i);
        if (idMatch) {
          id = idMatch[1];
          console.log("Found id in document:", id);
        }
      }

      if (!id) {
        id = `temp-${Date.now()}-${craftsmen.length}`;
        console.warn("Failed to extract id, using temporary fallback:", id);
        console.warn("Document content:", docContent);
      }

      const name = extractedRawData.name || "";
      const craft = extractedRawData.craft || "";

      if (!name || !craft) {
        console.warn(
          "Skipping document block due to missing name or craft. Raw data:",
          extractedRawData
        );
        continue;
      }

      let rating: number | undefined = undefined;
      let reviewCount: number | undefined = undefined;
      const ratingText = extractedRawData.ratingText;
      if (ratingText) {
        if (ratingText.includes("غير متوفر")) {
          rating = undefined;
          reviewCount = 0;
        } else {
          const ratingValMatch = ratingText.match(/^([0-9.]+)/);
          if (ratingValMatch) {
            rating = parseFloat(ratingValMatch[1]);
          }
          const reviewCountMatch =
            ratingText.match(/عدد التقييمات: ([0-9]+)/) ??
            ratingText.match(/\(([0-9]+)\)/) ??
            ratingText.match(/\((\d+)\s*تقييمات?\)/);
          if (reviewCountMatch && reviewCountMatch[1]) {
            reviewCount = parseInt(reviewCountMatch[1], 10);
          }
        }
      }

      let status = "free";
      const statusText = extractedRawData.statusText;
      if (statusText && /مشغول|busy/i.test(statusText)) {
        status = "busy";
      }

      const completedJobsText = extractedRawData.completedJobsText;
      const activeJobsText = extractedRawData.activeJobsText;
      const completedJobs = completedJobsText
        ? parseInt(completedJobsText, 10)
        : undefined;
      const activeJobs = activeJobsText
        ? parseInt(activeJobsText, 10)
        : undefined;

      let cities = extractedRawData.cities
        ? extractedRawData.cities
            .split(",")
            .map((city) => normalizeArabicText(city.trim()))
            .filter((city) => city)
            .join(", ")
        : undefined;

      const addressCombined = [extractedRawData.addressRaw]
        .filter(Boolean)
        .join(", ");

      craftsmen.push({
        id, 
        sourceId: extractedRawData.sourceId || `fallback-${Date.now()}-${craftsmen.length}`,
        name,
        craft,
        address: addressCombined || undefined,
        rating,
        reviewCount,
        description: extractedRawData.description || undefined,
        status,
        cities,
        completedJobs: !isNaN(completedJobs as number) ? completedJobs : undefined,
        activeJobs: !isNaN(activeJobs as number) ? activeJobs : undefined,
        image: extractedRawData.image || null,
      });
    } catch (error) {
      console.error(
        "Error parsing craftsman document block. Content:",
        docContent,
        "Error:",
        error
      );
    }
  }

  if (craftsmen.length === 0 && text.includes("--- المستند")) {
    console.warn(
      "Detected document markers but failed to extract any craftsmen data."
    );
  }

  return craftsmen;
}