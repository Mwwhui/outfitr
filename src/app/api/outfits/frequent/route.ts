import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase/server";

// GET /api/outfits/frequent?limit=10
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user_id = session?.user?.id;

  if (!user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    // Fetch current wardrobe item IDs (exclude deleted items)
    const { data: currentItems } = await supabase
      .from("clothes")
      .select("id")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .or("status.is.null,status.eq.available");

    const validItemIds = new Set((currentItems || []).map((i) => i.id));

    // Fetch all outfit plans for this user
    const { data: plans, error } = await supabase
      .from("outfit_plans")
      .select("id, date, time_slot, slots, name")
      .eq("user_id", user_id)
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase error /api/outfits/frequent:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json({ combos: [], total_outfits: 0 });
    }

    // Normalize each plan's slots into a sorted array of item IDs
    interface SlotItem {
      id: string;
      name: string;
      type: string;
      color?: string;
      image_url?: string;
      season?: string;
      brand?: string;
    }

    const comboMap = new Map<
      string,
      {
        frequency: number;
        lastDate: string;
        itemIds: string[];
        items: SlotItem[];
        dates: string[];
        name: string | null;
      }
    >();

    let validPlanCount = 0;

    for (const plan of plans) {
      if (!plan.slots || typeof plan.slots !== "object") continue;

      // Filter out deleted items from slots
      const items: SlotItem[] = [];
      for (const val of Object.values(plan.slots)) {
        if (val && typeof val === "object" && "id" in val) {
          const item = val as SlotItem;
          if (validItemIds.has(item.id)) {
            items.push(item);
          }
        }
      }

      if (items.length < 2) continue; // Need at least 2 valid items for a combo

      validPlanCount++;

      // Create a key from sorted item IDs
      const ids = items.map((i) => i.id).sort();
      const key = ids.join("::");

      const existing = comboMap.get(key);
      if (existing) {
        existing.frequency++;
        if (plan.date > existing.lastDate) existing.lastDate = plan.date;
        existing.dates.push(plan.date);
        // Keep the most recent name
        if (plan.name && !existing.name) existing.name = plan.name;
      } else {
        comboMap.set(key, {
          frequency: 1,
          lastDate: plan.date,
          itemIds: ids,
          items,
          dates: [plan.date],
          name: plan.name || null,
        });
      }
    }

    // Sort by frequency, take top N
    const sorted = Array.from(comboMap.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);

    const combos = sorted.map((combo) => ({
      key: combo.itemIds.join("::"),
      frequency: combo.frequency,
      last_worn: combo.lastDate,
      days_since_worn: Math.floor(
        (Date.now() - new Date(combo.lastDate).getTime()) / 86400000
      ),
      name: combo.name,
      items: combo.items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        color: item.color || null,
        image_url: item.image_url || null,
        season: item.season || null,
        brand: item.brand || null,
      })),
    }));

    return NextResponse.json({
      combos,
      total_outfits: validPlanCount,
      unique_combos: comboMap.size,
    });
  } catch (err) {
    console.error("API /api/outfits/frequent crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
