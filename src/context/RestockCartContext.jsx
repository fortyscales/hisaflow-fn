import React, { createContext, useContext, useState, useCallback } from "react";

const RestockCartContext = createContext(null);

export const RestockCartProvider = ({ children }) => {
  const [items, setItems] = useState([]); // { productId, productName, unit, quantity, buyingPrice }

  const addToRestockCart = useCallback((product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          productSize: product.size || null,
          unit: product.unit,
          quantity: 1,
          buyingPrice: Math.round(product.buyingPrice || 0),
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, quantity) }
          : item,
      ),
    );
  }, []);

  const updateBuyingPrice = useCallback((productId, buyingPrice) => {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, buyingPrice: Math.max(0, buyingPrice) }
          : item,
      ),
    );
  }, []);

  const removeFromRestockCart = useCallback((productId) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearRestockCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = items.reduce(
    (sum, item) => sum + item.quantity * item.buyingPrice,
    0,
  );

  return (
    <RestockCartContext.Provider
      value={{
        items,
        addToRestockCart,
        updateQuantity,
        updateBuyingPrice,
        removeFromRestockCart,
        clearRestockCart,
        totalItems,
        totalCost,
      }}
    >
      {children}
    </RestockCartContext.Provider>
  );
};

export const useRestockCart = () => useContext(RestockCartContext);


