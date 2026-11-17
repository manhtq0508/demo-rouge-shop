import { NextResponse } from "next/server";

type BaserowFile = { url?: string };
type BaserowRelation = { id: number; value: string };
type BaserowProduct = {
  id: number;
  name: string;
  rating: string | number;
  list_price: string | number;
  sale_price: string | number;
  badge?: { value?: string } | null;
  detail?: string;
  how_to_use?: string;
  ad_copy?: string;
  variants?: BaserowRelation[];
  image_link?: BaserowFile[];
};
type BaserowVariant = {
  id: number;
  name: string;
  product?: BaserowRelation[];
  color?: string;
  image_link?: BaserowFile[];
};
type BaserowBanner = {
  id: number;
  alt_text?: string;
  image_link?: BaserowFile[];
};

const requiredEnvironment = ["BASEROW_TOKEN", "BASEROW_PRODUCTS_TABLE_ID", "BASEROW_VARIANTS_TABLE_ID", "BASEROW_BANNERS_TABLE_ID"] as const;

function getEnvironment() {
  const missing = requiredEnvironment.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Thiếu cấu hình: ${missing.join(", ")}`);
  return {
    token: process.env.BASEROW_TOKEN as string,
    productsTableId: process.env.BASEROW_PRODUCTS_TABLE_ID as string,
    variantsTableId: process.env.BASEROW_VARIANTS_TABLE_ID as string,
    bannersTableId: process.env.BASEROW_BANNERS_TABLE_ID as string,
  };
}

async function getRows<T>(tableId: string, token: string): Promise<T[]> {
  const response = await fetch(`https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=200`, {
    headers: { Authorization: `Token ${token}` },
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    const details = await response.text();
    console.error("Không thể đọc dữ liệu catalog từ Baserow.", response.status, details);
    throw new Error("Baserow catalog request failed");
  }
  const body = (await response.json()) as { results?: T[] };
  return body.results ?? [];
}

function imageUrl(files?: BaserowFile[]) {
  return files?.[0]?.url ?? "";
}

export async function GET() {
  try {
    const environment = getEnvironment();
    const [productRows, variantRows, bannerRows] = await Promise.all([
      getRows<BaserowProduct>(environment.productsTableId, environment.token),
      getRows<BaserowVariant>(environment.variantsTableId, environment.token),
      getRows<BaserowBanner>(environment.bannersTableId, environment.token),
    ]);

    const variantsByProduct = new Map<number, BaserowVariant[]>();
    for (const variant of variantRows) {
      for (const product of variant.product ?? []) {
        variantsByProduct.set(product.id, [...(variantsByProduct.get(product.id) ?? []), variant]);
      }
    }

    const products = productRows.map((product) => {
      const variants = (variantsByProduct.get(product.id) ?? []).map((variant) => ({
        id: variant.id,
        name: variant.name,
        color: variant.color ?? "#d9b8bb",
        image: imageUrl(variant.image_link) || imageUrl(product.image_link),
      }));
      if (variants.length === 0) {
        variants.push({
          id: product.id * -1,
          name: "Mặc định",
          color: "#d9b8bb",
          image: imageUrl(product.image_link),
        });
      }
      return {
      id: product.id,
      name: product.name,
      rating: Number(product.rating) || 0,
      listPrice: Number(product.list_price) || 0,
      salePrice: Number(product.sale_price) || 0,
      badge: product.badge?.value && product.badge.value.toLowerCase() !== "normal" ? product.badge.value : undefined,
      image: imageUrl(product.image_link) || variants[0]?.image || "",
      adCopy: product.ad_copy ?? "",
      detail: product.detail ?? "",
      howToUse: product.how_to_use ?? "",
      variants,
      };
    });

    const banners = bannerRows.map((banner) => ({
      id: banner.id,
      alt: banner.alt_text ?? "Rouge Beauty banner",
      image: imageUrl(banner.image_link),
    }));

    return NextResponse.json({ products, banners });
  } catch (error) {
    console.error("Lỗi tải catalog.", error);
    return NextResponse.json({ error: "Không thể tải dữ liệu sản phẩm." }, { status: 502 });
  }
}
