import { NextResponse } from "next/server";

// Category interface with color coding
interface Category {
  id: string;
  name: string;
  color: string; // Tailwind background color class
  textColor: string; // Tailwind text color class
}

// Predefined clothing categories with color codes
const CATEGORIES: Category[] = [
  { id: "tops", name: "Tops", color: "bg-red-100", textColor: "text-red-700" },
  {
    id: "bottoms",
    name: "Bottoms",
    color: "bg-blue-100",
    textColor: "text-blue-700",
  },
  {
    id: "outerwear",
    name: "Outerwear",
    color: "bg-stone-100",
    textColor: "text-stone-700",
  },
  {
    id: "dresses",
    name: "Dresses",
    color: "bg-pink-100",
    textColor: "text-pink-700",
  },
  {
    id: "one-pieces",
    name: "One-Pieces",
    color: "bg-purple-100",
    textColor: "text-purple-700",
  },
  {
    id: "activewear",
    name: "Activewear",
    color: "bg-green-100",
    textColor: "text-green-700",
  },
  {
    id: "loungewear",
    name: "Loungewear",
    color: "bg-yellow-100",
    textColor: "text-yellow-700",
  },
  {
    id: "sleepwear",
    name: "Sleepwear",
    color: "bg-indigo-100",
    textColor: "text-indigo-700",
  },
  {
    id: "underwear",
    name: "Underwear",
    color: "bg-rose-100",
    textColor: "text-rose-700",
  },
  {
    id: "swimwear",
    name: "Swimwear",
    color: "bg-cyan-100",
    textColor: "text-cyan-700",
  },
  {
    id: "footwear",
    name: "Footwear",
    color: "bg-amber-100",
    textColor: "text-amber-700",
  },
  {
    id: "accessories",
    name: "Accessories",
    color: "bg-orange-100",
    textColor: "text-orange-700",
  },
  {
    id: "bags",
    name: "Bags",
    color: "bg-teal-100",
    textColor: "text-teal-700",
  },
];

/**
 * GET /api/categories
 * Returns a list of clothing categories with color codes
 *
 * Query Parameters:
 * - search: (optional) Filter categories by search term (case-insensitive)
 * - format: (optional) 'names' returns just category names, 'full' returns full objects (default: 'full')
 *
 * Response:
 * - 200: Array of category objects or names
 * - 500: Server error
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const format = searchParams.get("format") || "full";

    let result: Category[] | string[] = CATEGORIES;

    // Filter by search term if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      result = CATEGORIES.filter((category) =>
        category.name.toLowerCase().includes(searchLower)
      );
    }

    // Return names only if requested
    if (format === "names") {
      result = (result as Category[]).map((cat) => cat.name);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Categories API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 * This endpoint is for reference only - categories are hardcoded
 * To add/remove categories, update the CATEGORIES array above
 */
export async function POST(req: Request) {
  return NextResponse.json(
    {
      error:
        "Categories are predefined and cannot be added via this API. Update the CATEGORIES array in the route.ts file.",
    },
    { status: 405 }
  );
}
