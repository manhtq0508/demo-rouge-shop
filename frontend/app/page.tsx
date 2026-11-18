"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  X,
} from "lucide-react";

const RougeTryOnModal = dynamic(() => import("./components/RougeTryOnModal"), { ssr: false });

type Variant = {
  id: number;
  name: string;
  color: string;
  image: string;
};

type Product = {
  id: number;
  name: string;
  rating: number;
  listPrice: number;
  salePrice: number;
  badge?: string;
  image: string;
  adCopy: string;
  detail: string;
  howToUse: string;
  variants: Variant[];
};

type CatalogBanner = {
  id: number;
  alt: string;
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  tone: string;
};

type CartItem = {
  product: Product;
  variant: Variant;
  quantity: number;
};

const formatPrice = (price: number) => `${price.toLocaleString("vi-VN")}đ`;

function Rating({ value }: { value: number }) {
  return (
    <span className="rating" aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={14} fill={star <= Math.round(value) ? "currentColor" : "none"} />
      ))}
      <small>{value}</small>
    </span>
  );
}

export default function Home() {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogBanners, setCatalogBanners] = useState<CatalogBanner[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [activeBanner, setActiveBanner] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<number, Variant>>({});
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem("rouge-cart");
    if (!saved) return [];
    try {
      return JSON.parse(saved) as CartItem[];
    } catch (error) {
      console.error("Không thể đọc giỏ hàng đã lưu.", error);
      return [];
    }
  });
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [notice, setNotice] = useState("");
  const hasMounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    window.localStorage.setItem("rouge-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const response = await fetch("/api/catalog");
        const result = (await response.json()) as {
          products?: Product[];
          banners?: Array<{ id: number; alt: string; image: string }>;
          error?: string;
        };
        if (!response.ok || !result.products || !result.banners) {
          throw new Error(result.error ?? "Catalog response không hợp lệ");
        }
        setCatalogProducts(result.products);
        setCatalogBanners(result.banners.map((banner) => ({
          ...banner,
          eyebrow: "ROUGE BEAUTY",
          title: banner.alt,
          text: "Khám phá những sản phẩm làm đẹp dịu dàng dành riêng cho bạn.",
          tone: "rose",
        })));
        setActiveBanner(0);
      } catch (error) {
        console.error("Không thể tải dữ liệu sản phẩm từ Baserow.", error);
        setCatalogProducts([]);
        setCatalogBanners([]);
        setCatalogError("Không thể tải dữ liệu từ Baserow. Vui lòng tải lại trang.");
      }
    };
    void loadCatalog();
  }, []);

  useEffect(() => {
    if (catalogBanners.length === 0) return undefined;
    const timer = window.setInterval(() => setActiveBanner((current) => (current + 1) % catalogBanners.length), 4500);
    return () => window.clearInterval(timer);
  }, [catalogBanners.length]);

  const filteredProducts = useMemo(() => catalogProducts.filter((product) => {
    const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "Tất cả" || (category === "Đang giảm" && product.salePrice < product.listPrice) || (category === "Bán chạy" && product.badge?.toLowerCase() === "best");
    return matchesQuery && matchesCategory;
  }), [catalogProducts, category, query]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0);

  const addToCart = (product: Product, variant = selectedVariants[product.id] ?? product.variants[0]) => {
    setCart((current) => {
      const found = current.find((item) => item.product.id === product.id && item.variant.id === variant.id);
      if (found) return current.map((item) => item === found ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { product, variant, quantity: 1 }];
    });
    setNotice("Đã thêm sản phẩm vào giỏ hàng");
    window.setTimeout(() => setNotice(""), 2200);
  };

  const updateQuantity = (productId: number, variantId: number, amount: number) => {
    setCart((current) => current.flatMap((item) => {
      if (item.product.id !== productId || item.variant.id !== variantId) return [item];
      const quantity = item.quantity + amount;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  };

  const changeView = (product: Product | null) => {
    setSelectedProduct(product);
    setShowCart(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <header className="site-header">
        <button className="brand" onClick={() => changeView(null)} aria-label="Về trang chủ">
          <img className="brand-logo" src="/logo.png" alt="" />
          <img className="brand-name" src="/brand_name.png" alt="ROUGE" />
        </button>
        <nav>
          <button onClick={() => { setCategory("Tất cả"); changeView(null); }}>Trang chủ</button>
          <button onClick={() => { setCategory("Đang giảm"); changeView(null); }}>Ưu đãi</button>
          <button onClick={() => { setCategory("Bán chạy"); changeView(null); }}>Bán chạy</button>
        </nav>
        <div className="header-actions">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm..." /></label>
          <button className="cart-button" onClick={() => setShowCart(true)} aria-label="Mở giỏ hàng"><ShoppingBag size={21} /><span>{hasMounted ? cartCount : 0}</span></button>
        </div>
      </header>

      {selectedProduct ? (
        <ProductDetail product={selectedProduct} selectedVariant={selectedVariants[selectedProduct.id] ?? selectedProduct.variants[0]} onVariant={(variant) => setSelectedVariants({ ...selectedVariants, [selectedProduct.id]: variant })} onAdd={() => addToCart(selectedProduct)} onBack={() => changeView(null)} />
      ) : (
        <>
          {catalogBanners.length > 0 && <section className={`hero ${catalogBanners[activeBanner].tone}`}>
            <div className="hero-slides">{catalogBanners.map((banner, index) => banner.image && <div key={banner.id} className={index === activeBanner ? "hero-slide active" : "hero-slide"}><img className="hero-banner-image" src={banner.image} alt={banner.alt} /></div>)}</div>
            <div className="hero-radios" role="radiogroup" aria-label="Chọn banner">
              {catalogBanners.map((banner, index) => <label key={banner.id} className={index === activeBanner ? "hero-radio active" : "hero-radio"}><input type="radio" name="banner" checked={index === activeBanner} onChange={() => setActiveBanner(index)} aria-label={`Banner ${index + 1}`} /><span /></label>)}
            </div>
          </section>}
          {catalogError && <p className="catalog-error">{catalogError}</p>}
          <section className="products-section" id="products">
            <div className="section-heading"><div><p className="eyebrow">DÀNH CHO BẠN</p><h2>Sản phẩm nổi bật</h2></div><div className="filters"><button className={category === "Tất cả" ? "selected" : ""} onClick={() => setCategory("Tất cả")}>Tất cả</button><button className={category === "Đang giảm" ? "selected" : ""} onClick={() => setCategory("Đang giảm")}>Đang giảm</button><button className={category === "Bán chạy" ? "selected" : ""} onClick={() => setCategory("Bán chạy")}>Bán chạy</button></div></div>
            <div className="product-grid">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} selectedVariant={selectedVariants[product.id] ?? product.variants[0]} onVariant={(variant) => setSelectedVariants({ ...selectedVariants, [product.id]: variant })} onAdd={() => addToCart(product)} onDetail={() => changeView(product)} />)}</div>
            {filteredProducts.length === 0 && <div className="empty-search"><Search size={30} /><p>Không tìm thấy sản phẩm phù hợp.</p></div>}
          </section>
        </>
      )}

      <footer><div className="footer-main"><span className="brand"><img className="brand-logo" src="/logo.png" alt="" /><img className="brand-name" src="/brand_name.png" alt="ROUGE" /></span><span className="footer-text">BEAUTY LIVES FOREVER</span><span className="footer-text">© 2026 Rouge Beauty Studio</span></div><div className="footer-disclaimer"><strong>TUYÊN BỐ MIỄN TRỪ TRÁCH NHIỆM</strong><p>Trang web này được xây dựng nhằm phục vụ dự án bài tập cuối kỳ học phần Lý luận truyền thông. Toàn bộ thương hiệu, sản phẩm, hình ảnh quảng cáo và thông tin được trình bày trên trang web đều mang tính giả tưởng, được sáng tạo nhằm mục đích học tập và mô phỏng hoạt động truyền thông, không đại diện cho bất kỳ hoạt động kinh doanh thương mại thực tế nào.</p><p>Mọi thắc mắc hoặc yêu cầu liên quan đến dự án, vui lòng liên hệ:<br />Email: <a href="mailto:2656330008@hcmussh.edu.vn">2656330008@hcmussh.edu.vn</a></p></div></footer>

      {showCart && <CartDrawer cart={cart} total={total} onClose={() => setShowCart(false)} onQuantity={updateQuantity} onRemove={(productId, variantId) => setCart((current) => current.filter((item) => item.product.id !== productId || item.variant.id !== variantId))} onCheckout={() => { setShowCart(false); setShowCheckout(true); }} />}
      {showCheckout && <CheckoutModal cart={cart} total={total} onClose={() => setShowCheckout(false)} onSuccess={(emailSent) => { setCart([]); setShowCheckout(false); setNotice(emailSent ? "Đặt hàng thành công! Email xác nhận đã được gửi." : "Đặt hàng thành công! Email xác nhận chưa gửi được."); window.setTimeout(() => setNotice(""), 3500); }} />}
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}

function ProductCard({ product, selectedVariant, onVariant, onAdd, onDetail }: { product: Product; selectedVariant: Variant; onVariant: (variant: Variant) => void; onAdd: () => void; onDetail: () => void }) {
  const discount = Math.round((1 - product.salePrice / product.listPrice) * 100);
  const imageSource = selectedVariant.image || product.image;
  const [imgErrorSource, setImgErrorSource] = useState<string | null>(null);
  const imgError = !imageSource || imgErrorSource === imageSource;

  return <article className="product-card"><button className="product-image" onClick={onDetail}>{imgError ? <span className="product-image-placeholder"><ShoppingBag size={30} strokeWidth={1.4} /><span>{product.name}</span></span> : <img src={imageSource} alt="" onError={() => setImgErrorSource(imageSource)} />}<span className="quick-add" onClick={(event) => { event.stopPropagation(); onAdd(); }}>Thêm vào giỏ</span>{product.badge && <span className="badge">{product.badge}</span>}</button><div className="product-info"><button className="product-name" onClick={onDetail}>{product.name}</button><div className="product-meta"><Rating value={product.rating} /><div className="price-row"><strong>{formatPrice(product.salePrice)}</strong>{product.salePrice < product.listPrice && <><del>{formatPrice(product.listPrice)}</del><em>-{discount}%</em></>}</div><div className="variant-row"><span>Màu: {selectedVariant.name}</span><div>{product.variants.map((variant) => <button key={variant.id} className={variant.id === selectedVariant.id ? "color-dot active" : "color-dot"} style={{ backgroundColor: variant.color }} onClick={() => onVariant(variant)} aria-label={variant.name} />)}</div></div></div></div></article>;
}

function ProductDetail({ product, selectedVariant, onVariant, onAdd, onBack }: { product: Product; selectedVariant: Variant; onVariant: (variant: Variant) => void; onAdd: () => void; onBack: () => void }) {
  const discount = product.listPrice > product.salePrice ? Math.round((1 - product.salePrice / product.listPrice) * 100) : 0;
  const [showTryOn, setShowTryOn] = useState(false);
  const hasValidColor = /^#(?:[0-9a-f]{3}){1,2}$/i.test(selectedVariant.color);
  return <section className="detail-page"><button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Quay lại cửa hàng</button><div className="detail-layout"><div className="detail-image"><img src={selectedVariant.image || product.image} alt={`${product.name} - ${selectedVariant.name}`} /></div><div className="detail-copy"><p className="eyebrow">ROUGE ESSENTIAL</p><h1>{product.name}</h1><Rating value={product.rating} /><div className="detail-price"><strong>{formatPrice(product.salePrice)}</strong>{product.salePrice < product.listPrice && <><del>{formatPrice(product.listPrice)}</del><em>-{discount}%</em></>}</div><div className="detail-description markdown-content"><ReactMarkdown>{product.adCopy}</ReactMarkdown></div><div className="detail-variants"><strong>Chọn màu: {selectedVariant.name}</strong><div>{product.variants.map((variant) => <button key={variant.id} className={variant.id === selectedVariant.id ? "detail-swatch active" : "detail-swatch"} onClick={() => onVariant(variant)}><img src={variant.image} alt="" /><span style={{ backgroundColor: variant.color }} /></button>)}</div></div>{hasValidColor && <button className="try-on-button wide" onClick={() => setShowTryOn(true)}><Camera size={17} /> Thử màu má hồng (AR)</button>}<button className="primary-button wide" onClick={onAdd}>Thêm vào giỏ hàng <ShoppingBag size={17} /></button>{product.detail && <details open><summary>Chi tiết sản phẩm <ChevronDown size={16} /></summary><div className="markdown-content"><ReactMarkdown>{product.detail}</ReactMarkdown></div></details>}{product.howToUse && <details><summary>Hướng dẫn sử dụng <ChevronDown size={16} /></summary><div className="markdown-content"><ReactMarkdown>{product.howToUse}</ReactMarkdown></div></details>}</div></div>{showTryOn && <RougeTryOnModal variants={product.variants} selectedVariant={selectedVariant} onVariant={onVariant} onClose={() => setShowTryOn(false)} />}</section>;
}

function CartDrawer({ cart, total, onClose, onQuantity, onRemove, onCheckout }: { cart: CartItem[]; total: number; onClose: () => void; onQuantity: (productId: number, variantId: number, amount: number) => void; onRemove: (productId: number, variantId: number) => void; onCheckout: () => void }) {
  return <div className="overlay" onClick={onClose}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-heading"><h2>Giỏ hàng <span>{cart.length} sản phẩm</span></h2><button onClick={onClose} aria-label="Đóng"><X /></button></div>{cart.length === 0 ? <div className="cart-empty"><ShoppingBag size={48} strokeWidth={1} /><h3>Bạn không có gì trong giỏ hàng</h3><p>Hãy thêm một sản phẩm bạn yêu thích nhé.</p></div> : <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={`${item.product.id}-${item.variant.id}`}><img src={item.variant.image || item.product.image} alt={item.product.name} /><div className="cart-item-copy"><strong>{item.product.name}</strong><small>{item.variant.name}</small><b>{formatPrice(item.product.salePrice)}</b><div className="quantity"><button onClick={() => onQuantity(item.product.id, item.variant.id, -1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => onQuantity(item.product.id, item.variant.id, 1)}><Plus size={13} /></button></div></div><button className="remove-button" onClick={() => onRemove(item.product.id, item.variant.id)} aria-label="Xóa sản phẩm"><Trash2 size={16} /></button></div>)}</div><div className="cart-summary"><div><span>Tạm tính</span><strong>{formatPrice(total)}</strong></div><p>Phí vận chuyển sẽ được xác nhận khi giao hàng.</p><button className="primary-button wide" onClick={onCheckout}>Tiến hành thanh toán <ChevronRight size={17} /></button></div></>}</aside></div>;
}

function CheckoutModal({ cart, total, onClose, onSuccess }: { cart: CartItem[]; total: number; onClose: () => void; onSuccess: (emailSent: boolean) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.phone || !form.email || !form.address) {
      setError("Vui lòng nhập đầy đủ thông tin nhận hàng.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          phoneNumber: form.phone,
          email: form.email,
          address: form.address,
          orderDetail,
          total,
        }),
      });
      const result = (await response.json()) as { error?: string; emailSent?: boolean };
      if (!response.ok) {
        setError(result.error ?? "Không thể đặt hàng. Vui lòng thử lại.");
        return;
      }
      onSuccess(result.emailSent === true);
    } catch (requestError) {
      console.error("Không thể kết nối tới dịch vụ checkout.", requestError);
      setError("Không thể kết nối tới dịch vụ checkout. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };
  const orderDetail = cart.map((item) => `${item.quantity}x ${item.product.name} (Màu: ${item.variant.name}) - ${formatPrice(item.product.salePrice * item.quantity)}`).join("\n");
  return <div className="overlay" onClick={onClose}><div className="checkout-modal" onClick={(event) => event.stopPropagation()}><div className="drawer-heading"><div><p className="eyebrow">CHECKOUT</p><h2>Thông tin nhận hàng</h2></div><button onClick={onClose} aria-label="Đóng"><X /></button></div><form onSubmit={submit}><label>Họ và tên<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nguyễn Văn A" /></label><div className="form-grid"><label>Số điện thoại<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="09xx xxx xxx" /></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@email.com" /></label></div><label>Địa chỉ nhận hàng<textarea required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện..." /></label><div className="cod-box"><span>●</span><div><strong>Thanh toán khi nhận hàng (COD)</strong><small>Thanh toán bằng tiền mặt khi nhận được hàng.</small></div></div><div className="order-preview"><strong>Chi tiết đơn hàng</strong><pre>{orderDetail}</pre><div><span>Tổng thanh toán</span><b>{formatPrice(total)}</b></div></div>{error && <p className="form-error">{error}</p>}<button className="primary-button wide" type="submit" disabled={submitting}>{submitting ? "Đang xử lý..." : "Xác nhận đặt hàng"} {!submitting && <ChevronRight size={17} />}</button></form></div></div>;
}
