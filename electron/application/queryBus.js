'use strict';
const c=require('./contracts');
function createQueryBus({queries}){return {
  salesPage: input=>queries.getSalesPage(c.salesPageQuery(input)),
  dashboard: input=>queries.getDashboardAnalytics(c.dashboardQuery(input)),
  inventorySummary: ()=>queries.getInventorySummary(),
  receivablesSummary: ()=>queries.getReceivablesSummary(),
  staffSales: ()=>queries.getStaffSalesSummary(),
  overdueReceivables: input=>queries.getOverdueReceivablesSummary(input||{}),
};}
module.exports={createQueryBus};
