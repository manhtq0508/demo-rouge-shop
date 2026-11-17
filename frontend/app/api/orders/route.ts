import { NextResponse } from "next/server";

type OrderPayload = {
  customerName: string;
  phoneNumber: string;
  email: string;
  address: string;
  orderDetail: string;
  total: number;
};

const requiredEnvironment = [
  "BASEROW_TOKEN",
  "BASEROW_ORDERS_TABLE_ID",
  "NEXT_PUBLIC_EMAILJS_SERVICE_ID",
  "NEXT_PUBLIC_EMAILJS_TEMPLATE_ID",
  "NEXT_PUBLIC_EMAILJS_PUBLIC_KEY",
  "EMAILJS_PRIVATE_KEY",
] as const;

function getEnvironment() {
  const missing = requiredEnvironment.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Thiếu cấu hình: ${missing.join(", ")}`);
  }

  return {
    baserowToken: process.env.BASEROW_TOKEN as string,
    ordersTableId: process.env.BASEROW_ORDERS_TABLE_ID as string,
    emailServiceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID as string,
    emailTemplateId: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID as string,
    emailPrivateKey: process.env.EMAILJS_PRIVATE_KEY as string,
    emailPublicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY as string,
  };
}

function isValidPayload(payload: Partial<OrderPayload>): payload is OrderPayload {
  return Boolean(
    payload.customerName?.trim() &&
      payload.phoneNumber?.trim() &&
      payload.email?.trim() &&
      payload.address?.trim() &&
      payload.orderDetail?.trim() &&
      typeof payload.total === "number" &&
      payload.total > 0,
  );
}

export async function POST(request: Request) {
  try {
    const environment = getEnvironment();
    const payload = (await request.json()) as Partial<OrderPayload>;

    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: "Thông tin đơn hàng không hợp lệ." }, { status: 400 });
    }

    const orderId = `RG-${Date.now().toString(36).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const baserowResponse = await fetch(
      `https://api.baserow.io/api/database/rows/table/${environment.ordersTableId}/?user_field_names=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${environment.baserowToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
          customer_name: payload.customerName.trim(),
          phone_number: payload.phoneNumber.trim(),
          email: payload.email.trim(),
          address: payload.address.trim(),
          order_detail: payload.orderDetail.trim(),
          total: payload.total,
          status: "new",
          created_at: createdAt,
        }),
      },
    );

    if (!baserowResponse.ok) {
      const details = await baserowResponse.text();
      console.error("Baserow không thể lưu đơn hàng.", baserowResponse.status, details);
      return NextResponse.json({ error: "Không thể lưu đơn hàng. Vui lòng thử lại." }, { status: 502 });
    }

    const emailResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: environment.emailServiceId,
        template_id: environment.emailTemplateId,
        user_id: environment.emailPublicKey,
        accessToken: environment.emailPrivateKey,
        template_params: {
          order_id: orderId,
          customer_name: payload.customerName.trim(),
          phone_number: payload.phoneNumber.trim(),
          email: payload.email.trim(),
          to_email: payload.email.trim(),
          reply_to: payload.email.trim(),
          address: payload.address.trim(),
          order_detail: payload.orderDetail.trim(),
          total: `${payload.total.toLocaleString("vi-VN")}đ`,
        },
      }),
    });

    if (!emailResponse.ok) {
      const details = await emailResponse.text();
      console.error("EmailJS không thể gửi email xác nhận.", emailResponse.status, details);
      return NextResponse.json(
        { error: "Đơn hàng đã lưu nhưng chưa gửi được email xác nhận. Vui lòng liên hệ cửa hàng." },
        { status: 502 },
      );
    }

    return NextResponse.json({ orderId });
  } catch (error) {
    console.error("Lỗi xử lý checkout.", error);
    return NextResponse.json({ error: "Đã có lỗi xảy ra khi đặt hàng." }, { status: 500 });
  }
}
