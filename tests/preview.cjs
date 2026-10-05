// Local-only UI fixture. No live API, credentials, spreadsheet writes, or email.
const http = require('node:http'), fs = require('node:fs');
const stub = `<script>
const demoOrder = {orderId:'NL-2610-001',groupName:'Example Group',contact:'Example Contact',estimatedTotal:50,fulfilledTotal:30,status:'Ready',revision:1,itemCount:5};
const demoDraft = {reportingMonth:'October 2026',groupsServed:8,moneyCollected:245.50,moneySpent:180,other:'Regional order placed for next month.',savedAt:'2026-10-10'};
const demoCatalog = [{itemId:'B1',name:'Basic Text',category:'Books',price:10,stock:-2,active:true},{itemId:'P1',name:'IP #7 Am I an Addict',category:'IPs',price:1.45,stock:32,lowAt:20,packSize:5,active:true},{itemId:'SP3101',name:'IP #1 Quien, Que, Como y Por Que',category:'Spanish Lit',price:1.45,stock:0,lowAt:5,packSize:5,active:true}];
const formCatalog = demoCatalog.concat([{itemId:'K1',name:'30 Day Keytag',category:'Keytags',price:1.1,packSize:5},{itemId:'1500H&I',name:'NA White Booklet: H&I Edition',category:'H&I',price:0.92,packSize:1},{itemId:'3129H&I',name:'IP #29: Intro to NA Mtgs, H&I Edition',category:'H&I',price:1.45,packSize:5}]);
const responses = {
 getFormData:()=>({windowData:{meetingMonth:'October 2026',openDate:'September 4, 2026',closeDate:'October 1, 2026',isOpen:true},groups:['Example Group','H&I Subcommittee'],catalog:formCatalog,hiRules:{group:'H&I Subcommittee',onlyCategories:['H&I'],hiddenCategories:['Keytags','Medallions']}}),
 checkAccessCode:()=>({valid:true,token:'fixture',meetingMonth:'October 2026'}), getOrders:()=>[demoOrder], getAvailableMonths:()=>['October 2026','November 2026'], getCatalogAll:()=>demoCatalog,
 getOrderItems:()=>({items:[{orderId:demoOrder.orderId,rowId:demoOrder.orderId+'-01',sheetRow:2,itemId:'B1',name:'Basic Text',category:'Books',price:10,qtyOrdered:5,qtyFulfilled:3,stock:-2},{orderId:demoOrder.orderId,rowId:demoOrder.orderId+'-02',sheetRow:3,itemId:'P1',name:'IP #7 Am I an Addict',category:'IPs',price:1.45,qtyOrdered:2,qtyFulfilled:2,stock:32,packSize:5}],status:demoOrder.status,revision:demoOrder.revision}),
 getOrdersReport:(period,selection,group)=>{
  const base=[{...demoOrder,month:'October 2026',orderCount:1,requested:5,fulfilled:3,estimated:50,pending:30,collected:0,amount:30},
    {...demoOrder,orderId:'NL-2610-002',groupName:'Second Group',status:'Completed',month:'October 2026',orderCount:1,requested:2,fulfilled:2,estimated:20,pending:0,collected:20,amount:20},
    {...demoOrder,orderId:'NL-2611-001',status:'New',month:'November 2026',orderCount:1,requested:4,fulfilled:0,estimated:40,pending:40,collected:0,amount:40}];
  const selected=base.filter(o=>period==='annual'?o.month.endsWith(selection):o.month===selection),groups=[...new Set(selected.map(o=>o.groupName))],orders=selected.filter(o=>!group||o.groupName===group);
  const sum=rows=>rows.reduce((t,o)=>{['orderCount','requested','fulfilled','estimated','pending','collected'].forEach(k=>t[k]+=o[k]);return t;},{orderCount:0,requested:0,fulfilled:0,estimated:0,pending:0,collected:0});
  const totals=sum(orders),byGroup=groups.filter(g=>!group||g===group).map(g=>({groupName:g,...sum(orders.filter(o=>o.groupName===g))}));
  const months=period==='annual'?Array.from({length:12},(_,i)=>{const month=new Date(Number(selection),i,1).toLocaleString('en-US',{month:'long',year:'numeric'});return {month,...sum(orders.filter(o=>o.month===month))};}):[];
  return {period,selection,group,groups,orders,byGroup,totals,months,items:orders.length?[{name:'Basic Text',requested:totals.requested,fulfilled:totals.fulfilled,estimated:totals.estimated,fulfilledValue:totals.fulfilled*10}]:[]};
 },
 submitOrder:()=>({success:true,orderId:'NL-2610-002'}), completeOrder:()=>({success:true,revision:2}),
 getStockReport:()=>({stockAsOf:'2026-10-10T12:00:00Z',items:demoCatalog}),
 getInventoryReport:m=>({meetingMonth:m,stockAsOf:'2026-10-10T12:00:00Z',items:[{name:'Basic Text',groups:4,qtyOrdered:20,qtyFulfilled:12,unfilled:3,awaiting:5,stock:-2},{name:'An Introduction to NA',groups:3,qtyOrdered:50,qtyFulfilled:40,unfilled:0,awaiting:10,stock:30}]}),
 getChairReport:m=>{const r={...demoDraft,reportingMonth:m,groupsServed:m==='October 2026'?1:0,moneyCollected:m==='October 2026'?20:0};return {draft:r,live:r,finalized:{...r,version:2},revision:2,secretaryEmail:'secretary@example.invalid'};},
 getSettings:()=>({accessCode:'fixture',email:'chair@example.invalid',secretaryEmail:'secretary@example.invalid',schedule:[{month:'October 2026',open:'2026-09-04',close:'2026-10-01'}]}),getGroupsFull:()=>['Example Group'],
 previewChairEmail:m=>({success:true,previewId:'fixture',action:'send',recipient:'secretary@example.invalid',subject:'NORVANA Chair Report - '+m,body:'NORVANA Chair Report\\nReporting month: '+m+'\\nFinalized (version 2)\\nGroups Served: '+(m==='October 2026'?1:0)+'\\nCollected: $'+(m==='October 2026'?'20.00':'0.00')+'\\nSpent: $180.00\\nNotes: Regional order placed for next month.'})
};
function demoRunner(ok,fail){return new Proxy({}, {get:(_,name)=>name==='withSuccessHandler'?f=>demoRunner(f,fail):name==='withFailureHandler'?f=>demoRunner(ok,f):(...args)=>setTimeout(()=>{try{if(!responses[name])throw Error('Local preview: action disabled');const r=responses[name](...args);if(ok)ok(r);}catch(e){if(fail)fail(e);}},20)});}
window.google={script:{get run(){return demoRunner();}}};
window.addEventListener('load',()=>setTimeout(()=>{isLoggedIn=true;sessionToken='fixture';meetingMonth='October 2026';document.getElementById('bottom-nav').classList.add('logged-in');switchView('inventory');},80));
</script>`;
function renderPreview() {
 // Replacement callbacks preserve literal dollar signs in embedded report code.
 let html=fs.readFileSync('App.html','utf8').replace("<?!= HtmlService.createHtmlOutputFromFile('ReportUI').getContent(); ?>",()=>fs.readFileSync('ReportUI.html','utf8'));
 return html.replace('<script>',()=>stub+'<script>');
}
module.exports = { renderPreview };
if (require.main === module) http.createServer((req,res)=>{
 res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'});res.end(renderPreview());
}).listen(8765,'127.0.0.1',()=>console.log('Local fixture: http://127.0.0.1:8765'));
