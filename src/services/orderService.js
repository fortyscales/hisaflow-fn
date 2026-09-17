import { dataService } from "./DataService";

// An order ticket a staff member writes up for a customer before they
// reach the cashier — order_number and issuedBy are what make this
// useful as an accountability record, not just a shopping list. The
// cashier later looks an order up and fulfills it into a real sale
// through the normal cart flow; fulfilling here only marks the order
// settled, it doesn't touch stock itself.
export const orderService = {
  async createOrder({ issuedBy, customerName, customerPhone, items }) {
    return dataService.createOrder({
      issuedBy,
      customerName,
      customerPhone,
      items,
    });
  },

  async getOrders() {
    return dataService.getOrders();
  },

  async fulfillOrder(orderId) {
    return dataService.fulfillOrder(orderId);
  },

  async cancelOrder(orderId) {
    return dataService.cancelOrder(orderId);
  },
};


