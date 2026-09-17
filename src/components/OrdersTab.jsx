import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, Pressable } from 'react-native';
import { ClipboardList, Plus, Search, X } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';
import { orderRepository } from '../repositories/orderRepository';

const money = (n) => `TZS ${Math.round(Number(n)||0).toLocaleString('sw-TZ')}`;

export default function OrdersTab({ currentUser, onNavigateToSale }) {
  const { language } = useLanguage();
  const sw = language !== 'en';
  const products = useProductStore((s)=>s.products);
  const addToCart = useCartStore((s)=>s.addToCart);
  const updateCartItem = useCartStore((s)=>s.updateCartItem);
  const [orders,setOrders]=useState([]); const [search,setSearch]=useState(''); const [showCreate,setShowCreate]=useState(false);
  const [customerName,setCustomerName]=useState(''); const [customerPhone,setCustomerPhone]=useState(''); const [items,setItems]=useState([]); const [error,setError]=useState('');
  const load=()=>setOrders(orderRepository.list());
  useEffect(()=>{ load(); },[]);
  const filtered=useMemo(()=>orders.filter(o=>!search.trim() || `${o.orderNumber} ${o.customerName||''} ${o.customerPhone||''} ${o.issuedBy||''} ${(o.items||[]).map(i=>i.productName).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())),[orders,search]);
  const pending=filtered.filter(o=>o.status==='pending'), history=filtered.filter(o=>o.status!=='pending');
  const addItem=(p)=>setItems(prev=>prev.some(i=>i.productId===p.id)?prev.map(i=>i.productId===p.id?{...i,quantity:i.quantity+1}:i):[...prev,{productId:p.id,productName:p.name,quantity:1,expectedPrice:p.sellingPrice||0}]);
  const create=()=>{ const result=orderRepository.create({issuedBy:currentUser?.name||'Owner',customerName:customerName.trim(),customerPhone:customerPhone.trim(),items}); if(!result.success){setError(result.error);return;} setShowCreate(false);setItems([]);setCustomerName('');setCustomerPhone('');setError('');load(); };
  const fulfill=(o)=>{ (o.items||[]).forEach(i=>{ const p=products.find(p=>String(p.id)===String(i.productId)); if(!p || Number(p.stock||0)<=0)return; addToCart(p); updateCartItem(p.id,{quantity:Math.min(Number(i.quantity)||1,Number(p.stock)||0)}); }); const r=orderRepository.fulfill(o.id); if(r.success){load();onNavigateToSale?.();} };
  const cancel=(o)=>{orderRepository.cancel(o.id);load();};
  const OrderCard=({o})=><View className={`bg-surface border border-borderMuted rounded-2xl p-4 mb-3 ${o.status!=='pending'?'opacity-70':''}`}><View className="flex-row justify-between"><Text className="text-base font-bold text-textPrimary">#{String(o.orderNumber).padStart(4,'0')}</Text><Text className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${o.status==='pending'?'bg-warningLight text-warning':o.status==='fulfilled'?'bg-successLight text-success':'bg-dangerLight text-danger'}`}>{o.status}</Text></View><Text className="text-xs text-textMuted mt-1">{sw?'Imeandikwa na':'Issued by'}: {o.issuedBy||'—'}</Text>{o.customerName?<Text className="text-sm text-textPrimary mt-1">{o.customerName} {o.customerPhone?`• ${o.customerPhone}`:''}</Text>:null}<Text className="text-xs text-textMuted mt-2">{o.items.length} {sw?'bidhaa':'items'} • {money(o.items.reduce((s,i)=>s+(i.expectedPrice||0)*i.quantity,0))}</Text>{o.status==='pending'?<View className="flex-row gap-2 mt-3"><TouchableOpacity onPress={()=>fulfill(o)} className="flex-1 bg-primary rounded-xl py-2.5 items-center"><Text className="text-white font-semibold text-xs">{sw?'Pakia kwenye mauzo':'Load into sale'}</Text></TouchableOpacity><TouchableOpacity onPress={()=>cancel(o)} className="px-4 border border-border rounded-xl justify-center"><Text className="text-danger font-semibold text-xs">{sw?'Ghairi':'Cancel'}</Text></TouchableOpacity></View>:null}</View>;
  return <View className="flex-1 px-4"><FlatList data={[]} renderItem={null} ListHeaderComponent={<View><View className="pt-4 flex-row items-start justify-between"><View className="flex-1"><Text className="text-2xl font-bold text-textPrimary">{sw?'Oda':'Orders'}</Text><Text className="text-xs text-textMuted mt-1">{sw?'Andika oda kabla ya malipo; stock haitoki mpaka cashier akamilishe mauzo.':'Write an order before payment; stock only moves when the cashier completes the sale.'}</Text></View><TouchableOpacity onPress={()=>setShowCreate(true)} className="ml-3 bg-primary rounded-xl px-3 py-2.5 flex-row items-center"><Plus size={16} color="white"/><Text className="text-white text-xs font-semibold ml-1">{sw?'Oda mpya':'New order'}</Text></TouchableOpacity></View><View className="flex-row items-center bg-surface border border-border rounded-xl px-3 h-11 my-4"><Search size={17} color="#A8A29E"/><TextInput value={search} onChangeText={setSearch} placeholder={sw?'Tafuta namba, mteja au bidhaa':'Search number, customer or product'} placeholderTextColor="#A8A29E" className="flex-1 ml-2 text-textPrimary"/></View>{pending.length?<Text className="text-xs font-bold text-textMuted mb-2">{sw?'ZINAZOSUBIRI':'PENDING'}</Text>:null}{pending.map(o=><OrderCard key={o.id} o={o}/>)}{history.length?<Text className="text-xs font-bold text-textMuted mt-3 mb-2">{sw?'HISTORIA':'HISTORY'}</Text>:null}{history.map(o=><OrderCard key={o.id} o={o}/>)}{!filtered.length?<View className="items-center py-16"><ClipboardList size={34} color="#A8A29E"/><Text className="text-sm text-textMuted mt-3">{sw?'Hakuna oda bado':'No orders yet'}</Text></View>:null}</View>}/></View>
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={()=>setShowCreate(false)}>
        <Pressable className="flex-1 bg-black/30 justify-end" onPress={()=>setShowCreate(false)}>
          <Pressable className="bg-surface rounded-t-[28px] px-5 pt-5 pb-8 max-h-[90%]" onPress={e=>e.stopPropagation()}>
            <View className="flex-row justify-between items-center mb-4"><Text className="text-xl font-bold text-textPrimary">{sw?'Oda mpya':'New order'}</Text><TouchableOpacity onPress={()=>setShowCreate(false)} className="w-10 h-10 rounded-full bg-background items-center justify-center"><X size={20} color="#78716C"/></TouchableOpacity></View>
            {error?<Text className="bg-dangerLight text-danger rounded-xl p-3 mb-3 text-xs">{error}</Text>:null}
            <TextInput value={customerName} onChangeText={setCustomerName} placeholder={sw?'Jina la mteja (hiari)':'Customer name (optional)'} placeholderTextColor="#A8A29E" className="border border-border rounded-xl px-3 h-11 text-textPrimary mb-2"/>
            <TextInput value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" placeholder={sw?'Simu (hiari)':'Phone (optional)'} placeholderTextColor="#A8A29E" className="border border-border rounded-xl px-3 h-11 text-textPrimary mb-3"/>
            <Text className="text-xs font-bold text-textMuted mb-2">{sw?'CHAGUA BIDHAA':'SELECT PRODUCTS'}</Text>
            <FlatList data={products} keyExtractor={p=>String(p.id)} style={{maxHeight:280}} renderItem={({item:p})=>{const picked=items.find(i=>i.productId===p.id);return <TouchableOpacity disabled={(p.stock||0)<=0} onPress={()=>addItem(p)} className="flex-row items-center py-3 border-b border-borderMuted"><View className="flex-1"><Text className="text-sm font-semibold text-textPrimary">{p.name}</Text><Text className="text-[11px] text-textMuted">{money(p.sellingPrice)} • {sw?'stock':'stock'} {p.stock||0}</Text></View><Text className="text-primaryDark font-bold">{picked?`×${picked.quantity}`:'+'}</Text></TouchableOpacity>}}/>
            {items.length?<View className="mt-3"><Text className="text-xs text-textMuted mb-2">{items.length} {sw?'bidhaa zimechaguliwa':'items selected'}</Text><View className="flex-row flex-wrap gap-2">{items.map(i=><TouchableOpacity key={i.productId} onPress={()=>setItems(v=>v.filter(x=>x.productId!==i.productId))} className="bg-primaryLight rounded-full px-3 py-2"><Text className="text-xs text-primaryDark">{i.productName} ×{i.quantity}  ×</Text></TouchableOpacity>)}</View></View>:null}
            <TouchableOpacity disabled={!items.length} onPress={create} className={`rounded-2xl py-3.5 items-center mt-4 ${items.length?'bg-primary':'bg-border'}`}><Text className="text-white font-semibold">{sw?'Tengeneza Oda':'Create Order'}</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  ;
}


