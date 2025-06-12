interface City {
  city: string;
}

interface Craft {
  name: string;
}

interface SearchImage {
  id: number;
  image: string;
}

// interface Craftsman {
//   id: number;
//   name: string;
//   email: string;
//   address: string;
//   status: "busy" | "available" | string | null;
//   availability: string | null;
//   description: string;
//   image: string;
//   craft_id: number;
//   social_id: string | null;
//   social_type: string | null;
//   created_at: string;
//   updated_at: string;
//   done_jobs_num: number;
//   active_jobs_num: number;
//   cities: City[];
//   craft: Craft;
//   search_images: SearchImage[];
//   average_rating: number;
//   number_of_ratings: number;
// }
interface Craftsman {
  id: string; // Primary API ID (e.g., "3")
  sourceId: string; // Pinecone document ID (e.g., "fadd4f97-b23e-4407-b09b-142d70fee0cc")
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
  image?: string | null;
}
/******************************************home page data type */

interface CraftDataTypes {
  id: number;
  name: string;
  image: string;
  num_of_craftsmen: number;
}

type CraftName = {
  name: string;
};

type topCraftsman = {
  id: number;
  name: string;
  email: string;
  address: string;
  status: "busy" | "available" | "offline"; // حسب الحالة الممكنة
  availability: string | null;
  description: string;
  image: string;
  craft_id: number;
  social_id: string | null;
  social_type: string | null;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  done_jobs_num: number;
  average_rating: number;
  number_of_ratings: number;
  craft_name: CraftName[];
};

export type { City, Craft, SearchImage, Craftsman, CraftDataTypes, topCraftsman };
