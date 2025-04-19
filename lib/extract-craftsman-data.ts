interface Craftsman {
  id: string;
  name: string;
  craft: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  description?: string;
  status?: string;
  cities?: string;
  completedJobs?: number;
  activeJobs?: number;
}

/**
 * Check if a message contains craftsman data markers
 * @param text The message text
 */
export function messageContainsCraftsmanData(text: string): boolean {
  return text.includes("--- المستند") && text.includes("sourceId:");
}

/**
 * Extract craftsman data from AI message text, handling run-on fields.
 * @param text The message text containing craftsman information
 */
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
        { key: "sourceId", label: "sourceId:" },
      ];

      const extractedRawData: Record<string, string> = {};
      let currentPos = 0;

      const firstLabelPos = docContent.indexOf(fields[0].label);
      if (firstLabelPos === -1) {
        console.warn(
          "Could not find the first label 'اسم الحرفي:' in doc:",
          docContent
        );
        continue;
      }
      currentPos = firstLabelPos;

      for (let i = 0; i < fields.length; i++) {
        const currentField = fields[i];
        const nextFieldLabel =
          i + 1 < fields.length ? fields[i + 1].label : null;

        const labelPos = docContent.indexOf(currentField.label, currentPos);

        if (labelPos === -1) {
          continue;
        }

        const valueStartPos = labelPos + currentField.label.length;
        let valueEndPos = docContent.length;
        if (nextFieldLabel) {
          const nextLabelPos = docContent.indexOf(
            nextFieldLabel,
            valueStartPos
          );
          if (nextLabelPos !== -1) {
            valueEndPos = nextLabelPos;
          }
        }

        const rawValue = docContent
          .substring(valueStartPos, valueEndPos)
          .trim();
        if (rawValue) {
          extractedRawData[currentField.key] = rawValue;
        }

        currentPos = valueStartPos;
      }

      const id =
        extractedRawData.sourceId ||
        `fallback-${Date.now()}-${craftsmen.length}`;

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
      if (statusText && statusText.includes("مشغول")) {
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

      const addressCombined = [
        extractedRawData.addressRaw,
        extractedRawData.cities,
      ]
        .filter(Boolean)
        .join(", ");
      craftsmen.push({
        id,
        name,
        craft,
        address: addressCombined || undefined,
        rating,
        reviewCount,
        description: extractedRawData.description || undefined,
        status,
        cities: extractedRawData.cities || undefined,
        completedJobs: !isNaN(completedJobs as number)
          ? completedJobs
          : undefined,
        activeJobs: !isNaN(activeJobs as number) ? activeJobs : undefined,
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
