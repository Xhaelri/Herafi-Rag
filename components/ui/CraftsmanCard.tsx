import React from "react";
import { Star } from "lucide-react";

interface CraftsmanProps {
  id: string;
  name: string;
  craft: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  description?: string;
  status?: string;
  image?: string | null; // Added image prop
}

export const CraftsmanCard: React.FC<CraftsmanProps> = ({
  id,
  name,
  craft,
  rating = 0,
  reviewCount = 0,
  address = "",
  description = "",
  status = "free",
  image = null, // Added image prop with default value
}) => {
  const shortDescription = description
    ? description.length > 100
      ? description.substring(0, 100) + "..."
      : description
    : "لا يوجد وصف متاح";

  return (
    <div className="bg-[#ffffff] border border-[#C0392B] rounded-2xl shadow-md hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
      <div className="p-3">
        <div className="flex items-start justify-between ">
          <div className="flex items-center  space-x-4 rtl:space-x-reverse">
            {image ? ( // Added conditional rendering for image
              <img
                src={image}
                alt={`صورة ${name}`}
                className="w-12 h-12 rounded-full object-cover border border-[#C0392B]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#F4D03F] flex items-center justify-center text-[#C0392B] text-xl font-aboreto">
                {name.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-lg font-aboreto text-[#8D5524]">
                {name}
              </h3>
              <p className="text-sm font-inter text-[#8D5524]">
                {craft}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            {status === "free" ? (
              <span className="px-3 py-1 text-xs font-rubik rounded-full bg-[#2db400] text-[#ffffff]">
                متاح
              </span>
            ) : (
              <span className="px-3 py-1 text-xs font-rubik rounded-full bg-[#C0392B] text-[#FFFFFF]">
                مشغول
              </span>
            )}
          </div>
        </div>

        <div className="mt-4">
          {address && (
            <p className="text-xs font-inter text-[#8D5524] mb-2">
              {address}
            </p>
          )}
          <p className="text-sm font-inter text-[#8D5524] leading-relaxed">
            {shortDescription}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <div className="flex items-center">
              <Star className="h-4 w-4 text-[#F4D03F] fill-[#F4D03F]" />
              <span className="text-sm font-inter font-medium ml-1 mr-1 text-[#8D5524]">
                {rating ? rating.toFixed(1) : "جديد"}
              </span>
            </div>
            {reviewCount > 0 && (
              <span className="text-xs font-inter text-[#8D5524]">
                ({reviewCount} تقييم)
              </span>
            )}
          </div>
          <a
            href={`/craftsman/${id}`}
            className="text-sm font-rubik text-[#8D5524] hover:text-[#C0392B] transition-colors duration-200"
            aria-label={`عرض ملف ${name}`}
          >
            عرض الملف
          </a>
        </div>
      </div>
    </div>
  );
};