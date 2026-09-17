'use strict';
const {createCommandBus}=require('./commandBus');
const {createQueryBus}=require('./queryBus');
function createApplication({queries}){return {commands:createCommandBus({queries}),queries:createQueryBus({queries})};}
module.exports={createApplication};
