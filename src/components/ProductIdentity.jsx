import React from "react";
import { Package } from "lucide-react";

const compact = (parts) => parts.filter((v) => String(v || "").trim()).join(" · ");

export const productIdentityText = (product = {}) => compact([
  product.brand,
  product.size,
  product.unit,
]);

export default function ProductIdentity({ product, showCategory = true, showStock = false, compact: isCompact = false }) {
  if (!product) return null;
  const meta = productIdentityText(product);
  return (
    <div style={{display:"flex",alignItems:"center",gap:isCompact?8:10,minWidth:0}}>
      {product.imageUri ? <img src={product.imageUri} alt="" style={{width:isCompact?34:46,height:isCompact?34:46,borderRadius:9,objectFit:"cover",flexShrink:0}} /> :
        <div style={{width:isCompact?34:46,height:isCompact?34:46,borderRadius:9,background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Package size={isCompact?15:18} color="var(--text-muted)"/></div>}
      <div style={{minWidth:0,flex:1}}>
        <div style={{fontWeight:800,fontSize:isCompact?13:14,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{product.name}</div>
        {meta && <div style={{fontSize:12,fontWeight:700,color:"var(--primary-dark)",marginTop:2}}>{meta}</div>}
        {showCategory && product.category && <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{product.category}</div>}
        {showStock && <div style={{fontSize:11,color:"var(--text-secondary)",marginTop:2}}>Stock: {product.stock || 0} {product.unit || ""}</div>}
      </div>
    </div>
  );
}
