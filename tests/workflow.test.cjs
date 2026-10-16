const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('assembled local preview loads Reports and the Inventory Report shortcut',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[];
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},contains(){return false;}},insertAdjacentHTML(where,s){this.innerHTML+=s;}};}
  const storage={getItem:()=>null,setItem(){},removeItem(){}};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,
    setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  function flush(){let n=0;while(timers.length){assert.ok(n++<30,'callbacks must settle');timers.shift()();}}
  vm.runInContext("meetingMonth='October 2026';sessionToken='fixture';switchView('reports');",c);flush();
  assert.match(elements['reports-content'].innerHTML,/>Inventory</);
  assert.equal((elements['reports-content'].innerHTML.match(/class="report-mode-tab/g)||[]).length,4);
  assert.match(elements['report-panel'].innerHTML,/Example Group/);
  vm.runInContext("changeOrdersPeriod('annual');",c);flush();
  assert.match(elements['report-panel'].innerHTML,/Monthly breakdown/);
  vm.runInContext("setOrdersView('item');changeReportGroup('Second Group');",c);flush();
  assert.match(elements['report-panel'].innerHTML,/Fulfilled Value/);assert.match(elements['report-panel'].innerHTML,/20\.00/);
  assert.equal(vm.runInContext('ordersReportData.totals.collected',c),20);
  assert.equal(vm.runInContext('ordersReportData.totals.pending',c),0);
  vm.runInContext("changeOrdersPeriod('monthly');",c);flush();
  vm.runInContext('openInventoryReport();',c);flush();
  assert.match(elements['report-panel'].innerHTML,/Stock as of/);
  assert.match(elements['report-panel'].innerHTML,/Basic Text/);
  assert.doesNotMatch(elements['report-panel'].innerHTML,/Loading/);
  vm.runInContext("setReportMode('chair');",c);flush();
  assert.match(elements['report-panel'].innerHTML,/Groups Served/);
  assert.match(elements['report-panel'].innerHTML,/20\.00/);  vm.runInContext("alert('Choose an access code of at least 8 characters.')",c);
  assert.equal(elements['notice-text'].textContent,'Choose an access code of at least 8 characters.');
  // Sign-out wipes every private screen, and a slow reply arriving afterwards is ignored.
  assert.match(elements['report-panel'].innerHTML,/Groups Served/);
  vm.runInContext("clearPrivateScreens();dashboardSignedOut=true;renderOrders([{orderId:'O',groupName:'Secret Group',status:'New',estimatedTotal:1,revision:0}]);renderSettings({email:'private@example.invalid',schedule:[]},[]);",c);
  assert.doesNotMatch(elements['reports-content'].innerHTML+elements['settings-content'].innerHTML+elements['orders-list'].innerHTML+elements['panel-body'].innerHTML,/Secret Group|private@example|Groups Served|Basic Text/);
  assert.equal(vm.runInContext('allOrders.length',c),0);assert.equal(vm.runInContext('ordersReportData',c),null);assert.equal(vm.runInContext('chairData',c),null);
});

function fixture() {
  const headers = ['Order ID','Timestamp','Area Meeting Month','Group Name','Contact Name','Email','Phone','Estimated Total','Fulfilled Total','Status','Fulfilled At','Revision'];
  const tables = {
    Orders: [headers, ['NL-2610-001','','October 2026','Group A','Contact','test@example.invalid','',50,'','New','',0]],
    'Order Items': [['Row ID','Order ID','Item ID','Item Name','Unit Price','Qty Ordered','Qty Fulfilled','Line Total'], ['NL-2610-001-01','NL-2610-001','B1','Book',10,5,'','']],
    Catalog: [['Item ID','Category','Item Name','Unit Price','Stock','Active'],['B1','Books','Book',99,2,'YES'],['B2','Books','Inactive',5,0,'NO']],
    Config: [['Setting','Value'],['Dashboard Access Code','test'],['Lit Chair Email','chair@example.invalid'],['Secretary Email','secretary@example.invalid']],
    Schedule: [['Meeting Month','Window Open','Window Close'],['October 2026',new Date('2026-09-04T04:00:00Z'),new Date('2026-10-01T04:00:00Z')],['November 2026',new Date('2026-10-02T04:00:00Z'),new Date('2026-11-05T05:00:00Z')]],
    Groups: [['Group'],['Group A']], 'Monthly Report': [['Group']],
    'Chair Reports': [['Presentation Month','Draft JSON','Finalized JSON','Revision','Email Attempt JSON']]
  };
  const names = Object.keys(tables), cache = new Map([['session_test','1']]), props = new Map();
  let locked = false, failBatch = false, loseResponse = false, failMail = false, hook = null, quota = 100, mailHook = null, acceptThenThrow = false, mailCalls = 0;
  const emails = [], appendLog = [];
  function range(name,row,col,n=1,m=1) {
    return { getValues: () => Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>tables[name][row-1+i]?.[col-1+j] ?? '')),
      setValues(values) { values.forEach((r,i)=>r.forEach((v,j)=> {tables[name][row-1+i] ||= [];tables[name][row-1+i][col-1+j]=v;})); return this; },
      setValue(v) {return this.setValues([[v]]);} };
  }
  const sheet = name => tables[name] ? { getSheetId:()=>names.indexOf(name), getDataRange:()=>({getValues:()=>tables[name].map(r=>r.slice())}), getRange:(...a)=>range(name,...a), appendRow:r=>{appendLog.push({sheet:name,row:r.slice()});return tables[name].push(r);}, getLastRow:()=>tables[name].length, clearContents:()=>tables[name]=[], deleteRow:r=>tables[name].splice(r-1,1), deleteRows:(r,n)=>tables[name].splice(r-1,n) } : null;
  function formatDate(d,tz,format) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
    if(format==='yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
    const month = new Intl.DateTimeFormat('en-US',{timeZone:tz,month:'long'}).format(d);
    if(format==='MMMM yyyy') return month+' '+parts.year;
    return month+' '+Number(parts.day)+', '+parts.year;
  }
  const context = vm.createContext({console,Date,Set,Map,JSON,Math,Number,Object,String,Array,RegExp,Error,
    SpreadsheetApp:{openById:()=>({getSheetByName:sheet})}, Session:{getScriptTimeZone:()=> 'America/New_York'},
    Utilities:{formatDate,getUuid:()=>require('node:crypto').randomUUID(),base64Decode:b=>Array.from(Buffer.from(b,'base64')),newBlob:(bytes,type,name)=>({bytes,type,name,size:bytes.length})},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
    MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:e=>{mailCalls++;if(failMail)throw Error('Mail failed');emails.push(e);if(mailHook)mailHook();if(acceptThenThrow)throw Error('Mail response lost');}},
    LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>locked=false})},
    Sheets:{Spreadsheets:{batchUpdate:({requests})=>{
      if(hook){const h=hook;hook=null;h();}
      if(failBatch)throw Error('Injected write failure');
      const copy=structuredClone(tables);
      for(const req of requests){
        if(req.updateCells){const u=req.updateCells,n=names[u.start.sheetId];u.rows.forEach((r,i)=>{copy[n][u.start.rowIndex+i] ||= [];r.values.forEach((c,j)=>{const v=c.userEnteredValue;copy[n][u.start.rowIndex+i][u.start.columnIndex+j]=v.numberValue ?? v.stringValue;});});}
        else {const r=req.deleteDimension.range;copy[names[r.sheetId]].splice(r.startIndex,r.endIndex-r.startIndex);}
      }
      Object.assign(tables,copy);
      if(loseResponse){loseResponse=false;throw Error('Response lost after commit');}
    }}}
  });
  for(const file of ['Code.gs','OrderWorkflow.gs','ChairReports.gs','EmailTemplate.gs']) vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  const oid='NL-2610-001', quantities=q=>[{rowId:oid+'-01',qtyFulfilled:q}];
  return {c:context,tables,emails,appendLog,oid,quantities,stock:()=>tables.Catalog[1][4],rev:()=>tables.Orders[1][11],
    ready:q=>context.fulfillOrder(oid,quantities(q),999999,'test',tables.Orders[1][11]),
    failBatch:v=>failBatch=v,loseResponse:()=>loseResponse=true,failMail:(v=true)=>failMail=v,hook:h=>hook=h,lock:v=>locked=v,quota:v=>quota=v,mailHook:h=>mailHook=h,acceptThenThrow:v=>acceptThenThrow=v,mailCalls:()=>mailCalls};
}

test('Ready → reopen → revised Ready uses original prices and restores exactly once',()=>{
  const f=fixture(); assert.equal(f.ready(4).success,true); assert.equal(f.stock(),-2); assert.equal(f.tables.Orders[1][8],40);
  assert.equal(f.c.reopenOrder(f.oid,'test',1).success,true); assert.equal(f.stock(),2);assert.equal(f.tables['Order Items'][1][6],4);assert.equal(f.emails.length,1);
  assert.equal(f.c.reopenOrder(f.oid,'test',1).success,false);assert.equal(f.stock(),2);
  assert.equal(f.ready(3).success,true); assert.equal(f.stock(),-1);assert.equal(f.tables.Orders[1][8],30);assert.equal(f.tables.Orders[1][7],50);assert.equal(f.emails.length,2);assert.match(f.emails[1].body,/30\.00/);
  assert.equal(f.c.fulfillOrder(f.oid,f.quantities(4),40,'test',0).success,false);assert.equal(f.stock(),-1);
});
test('retries, concurrent requests, atomic failure and lost response cannot duplicate stock',()=>{
  const f=fixture();let concurrent;
  f.hook(()=>concurrent=f.c.fulfillOrder(f.oid,f.quantities(5),50,'test',0));
  assert.equal(f.ready(5).success,true);assert.equal(concurrent.success,false);assert.equal(f.stock(),-3);
  assert.equal(f.c.fulfillOrder(f.oid,f.quantities(5),50,'test',0).success,false);assert.equal(f.stock(),-3);
  const g=fixture();g.failBatch(true);assert.equal(g.ready(5).success,false);assert.equal(g.stock(),2);assert.equal(g.rev(),0);
  g.failBatch(false);g.loseResponse();assert.equal(g.ready(5).success,false);assert.equal(g.stock(),-3);
  assert.equal(g.c.fulfillOrder(g.oid,g.quantities(5),50,'test',0).success,false);assert.equal(g.stock(),-3);
});
test('Undo Pickup has no stock effect; Completed cannot be deleted; Ready delete restores once',()=>{
  const f=fixture();assert.equal(f.c.completeOrder(f.oid,'test',0).success,false);f.ready(4);
  assert.equal(f.c.completeOrder(f.oid,'test',1).success,true);assert.equal(f.stock(),-2);
  assert.equal(f.c.deleteOrder(f.oid,'test',2).success,false);
  assert.equal(f.c.uncompleteOrder(f.oid,'test',2).success,true);assert.equal(f.stock(),-2);
  assert.equal(f.c.deleteOrder(f.oid,'test',3).success,true);assert.equal(f.stock(),2);
  assert.equal(f.c.deleteOrder(f.oid,'test',3).success,true);assert.equal(f.stock(),2);
  const g=fixture();g.c.deleteOrder(g.oid,'test',0);assert.equal(g.stock(),2);
});
test('manual stock replaces counts and negative counts never restrict ordering',()=>{
  const f=fixture();assert.equal(f.c.updateStockCounts([{itemId:'B1',stock:-8}],'test').success,true);assert.equal(f.stock(),-8);
  assert.equal(f.c.getCatalogForForm().length,1);assert.equal(f.c.getCatalogForForm()[0].itemId,'B1');
  assert.equal(f.ready(5).success,true);assert.equal(f.stock(),-13);
  f.c.updateStockCounts([{itemId:'B1',stock:80}],'test');assert.equal(f.stock(),80);
  assert.equal(f.c.updateStockCounts([{itemId:'B1',stock:1.2}],'test').success,false);
});
test('zero fulfillment, invalid quantities, draft protection, mail failure',()=>{
  const f=fixture();assert.equal(f.ready(6).success,false);assert.equal(f.ready(1.2).success,false);assert.equal(f.stock(),2);
  f.failMail();const r=f.ready(0);assert.equal(r.success,true);assert.ok(r.warning);assert.equal(f.tables.Orders[1][8],0);
  assert.equal(f.c.autoSaveFulfillment(f.oid,f.quantities(4),'test',1).success,false);
});
test('selected-month inventory distinguishes unfinished demand and counts distinct groups',()=>{
  const f=fixture();f.tables.Orders.push(['NL-2610-002','','Oct 2026',' group a ','','','',20,10,'Completed','',0],['NL-2611-001','','November 2026','Other','','','',100,100,'Completed','',0]);
  f.tables['Order Items'].push(['NL-2610-002-01','NL-2610-002','B1','Book',10,2,1,10],['NL-2611-001-01','NL-2611-001','B1','Book',10,10,10,100]);
  f.c.autoSaveFulfillment(f.oid,f.quantities(2),'test',0);
  const r=f.c.getInventoryReport('October 2026','test').items[0];
  assert.equal(r.groups,1);assert.equal(r.qtyOrdered,7);assert.equal(r.qtyFulfilled,1);assert.equal(r.unfilled,1);assert.equal(r.awaiting,5);
  assert.equal(f.c.getMonthlyReport('December 2026','test').rows.length,0);
  assert.equal(f.c.getItemSummaryReport('October 2026','test').items[0].qtyFulfilled,1);
});

test('annual orders aggregate each order once and separate order totals from item values',()=>{
  const f=fixture();f.ready(3);
  const add=(id,month,group,price,qty,fulfilled,status,item)=>{
    f.tables.Orders.push([id,'',month,group,'','','',price*qty,status==='New'?'':price*fulfilled,status,'',0]);
    f.tables['Order Items'].push([id+'-01',id,item,item,price,qty,fulfilled,price*fulfilled]);
  };
  add('O2','Oct 2026',' group a ',12,2,1,'Completed','B1');
  add('O3','November 2026','Group B',3,4,3,'New','B2');
  add('O4','December 2026','Group B',2,5,4,'Completed','B2');
  add('OLD','October 2025','Group A',10,100,100,'Completed','B1');
  add('NEXT','January 2027','Group A',10,100,100,'Ready','B1');
  f.tables.Orders.push(f.tables.Orders[1].slice());
  f.tables['Order Items'].push(f.tables['Order Items'][1].slice());
  const annual=f.c.getOrdersReport('annual','2026','','test');
  assert.equal(annual.totals.orderCount,4);assert.equal(annual.totals.requested,16);assert.equal(annual.totals.fulfilled,8);
  assert.equal(annual.totals.estimated,96);assert.equal(annual.totals.collected,20);assert.equal(annual.totals.pending,42);
  assert.equal(annual.byGroup.length,2);assert.equal(annual.items.length,2);assert.equal(annual.months.length,12);
  const book=annual.items.find(i=>i.itemId==='B1');assert.equal(book.estimated,74);assert.equal(book.fulfilledValue,42);
  const pamphlet=annual.items.find(i=>i.itemId==='B2');assert.equal(pamphlet.requested,9);assert.equal(pamphlet.fulfilled,4);assert.equal(pamphlet.estimated,22);assert.equal(pamphlet.fulfilledValue,8);
  for(const k of ['orderCount','requested','fulfilled','estimated','collected','pending']){
    assert.equal(annual.byGroup.reduce((s,r)=>s+r[k],0),annual.totals[k]);
    assert.equal(annual.months.reduce((s,r)=>s+r[k],0),annual.totals[k]);
  }
  const october=f.c.getOrdersReport('monthly','October 2026','','test');assert.equal(october.orders.length,2);assert.equal(october.totals.estimated,74);assert.equal(october.totals.pending,30);assert.equal(october.totals.collected,12);
  const filtered=f.c.getOrdersReport('annual','2026','GROUP B','test');assert.equal(filtered.orders.length,2);assert.equal(filtered.totals.estimated,22);assert.equal(filtered.items.length,1);assert.equal(filtered.items[0].fulfilled,4);
  assert.equal(f.c.getOrdersReport('annual','2024','','test').totals.orderCount,0);
  assert.equal(f.c.getOrdersReport('monthly','September 2026','','test').orders.length,0);
  assert.equal(f.c.getOrdersReport('annual','invalid','','test').success,false);
});

test('Inventory stock report reads only current recorded counts including inactive and negative stock',()=>{
  const f=fixture();f.ready(4);const r=f.c.getStockReport('test');
  assert.equal(r.items.find(i=>i.itemId==='B1').stock,-2);assert.equal(r.items.find(i=>i.itemId==='B2').stock,0);assert.ok(r.stockAsOf);
  assert.equal(r.meetingMonth,undefined);assert.equal(r.items[0].qtyOrdered,undefined);
});

test('legacy Chair Report keys keep their reporting-month association and frozen snapshots',()=>{
  const f=fixture();
  const legacy={presentationMonth:'November 2026',reportingMonth:'October 2026',groupsServed:7,moneyCollected:123.45,moneySpent:90,other:'Saved notes',savedAt:'2026-11-01',finalizedAt:'2026-11-01',version:9};
  const finalJSON=JSON.stringify(legacy),emailJSON=JSON.stringify({status:'sent',version:9,at:'2026-11-01',recipient:'secretary@example.invalid'});
  f.tables['Chair Reports'].push(['November 2026',finalJSON,finalJSON,9,emailJSON]);
  const r=f.c.getChairReport('October 2026','test');assert.equal(r.finalized.moneyCollected,123.45);assert.equal(r.finalized.reportingMonth,'October 2026');assert.equal(r.revision,9);
  assert.equal(f.c.getChairReport('November 2026','test').finalized,null);
  assert.equal(f.c.saveChairDraft('October 2026',95,'New notes',9,'test').success,true);
  assert.equal(f.tables['Chair Reports'][1][0],'November 2026');assert.equal(f.tables['Chair Reports'][1][2],finalJSON);assert.equal(f.tables['Chair Reports'][1][4],emailJSON);
  const preview=f.c.previewChairEmail('October 2026','test');assert.match(preview.subject,/October 2026/);assert.match(preview.body,/Spent: \$95\.00/);assert.doesNotMatch(preview.body,/November|Presentation|Money collected|Other:/);
  f.c.saveChairDraft('November 2026',10,'New report',0,'test');
  assert.equal(f.tables['Chair Reports'].length,3);assert.equal(f.c.getChairReport('November 2026','test').draft.moneySpent,10);assert.equal(f.c.getChairReport('October 2026','test').draft.moneySpent,95);
  assert.ok(f.c.getAvailableMonths('test').includes('October 2026'));
});

test('January Chair selection reports January and preserves legacy December association across years',()=>{
  const f=fixture();const r={presentationMonth:'January 2027',reportingMonth:'December 2026',groupsServed:1,moneyCollected:18,moneySpent:0,other:'',version:1};
  f.tables['Chair Reports'].push(['January 2027',JSON.stringify(r),JSON.stringify(r),1,'']);
  assert.equal(f.c.getChairReport('December 2026','test').finalized.moneyCollected,18);
  assert.equal(f.c.getChairReport('January 2027','test').finalized,null);
  f.c.saveChairDraft('January 2027',2,'',0,'test');assert.equal(f.c.getChairReport('January 2027','test').draft.reportingMonth,'January 2027');
});
test('chair reports are presented in the selected month but total the previous month orders; the sent version changes only when sent again',()=>{
  const f=fixture();f.ready(3);f.c.completeOrder(f.oid,'test',1);
  f.tables.Orders.push(['another','','October 2026','Group A','','','',10,10,'Completed','',0],['nov','','November 2026','Group B','','','',100,100,'Completed','',0]);
  let r=f.c.getChairReport('November 2026','test');assert.equal(r.live.groupsServed,1);assert.equal(r.live.moneyCollected,40);assert.equal(r.draft.reportingMonth,'November 2026');assert.equal(r.live.ordersMonth,'October 2026');assert.equal(f.c.getChairReport('December 2026','test').live.moneyCollected,100);
  assert.equal(f.c.saveChairDraft('November 2026',75,'Notes',0,'test').revision,1);
  let p=f.c.previewChairEmail('November 2026','test');assert.match(p.body,/Reporting month: November 2026\nOrders recap: October 2026/);assert.equal(f.c.sendChairReport(p.previewId,'test',p.action).success,true);const stock=f.stock();
  f.c.uncompleteOrder(f.oid,'test',2);
  r=f.c.getChairReport('November 2026','test');assert.equal(r.live.moneyCollected,10);assert.equal(r.draft.moneyCollected,10);
  assert.equal(r.finalized.moneyCollected,40);assert.equal(r.finalized.version,1);assert.ok(r.finalized.sentAt);assert.equal(r.finalized.recipient,'secretary@example.invalid');
  assert.equal(f.c.saveChairDraft('November 2026',80,'Updated',r.revision,'test').success,true);
  r=f.c.getChairReport('November 2026','test');assert.equal(r.finalized.moneySpent,75);
  p=f.c.previewChairEmail('November 2026','test');assert.equal(p.action,'resend');assert.match(p.body,/Revised report \(version 2\)/);
  assert.equal(f.c.sendChairReport(p.previewId,'test',p.action).success,true);
  r=f.c.getChairReport('November 2026','test');assert.equal(r.finalized.moneyCollected,10);assert.equal(r.finalized.moneySpent,80);assert.equal(r.finalized.version,2);
  assert.equal(r.finalized.history.length,1);assert.equal(r.finalized.history[0].moneyCollected,40);assert.equal(r.finalized.history[0].moneySpent,75);assert.equal(f.stock(),stock);
});
test('autosaved Spent edits after a preview make that preview unusable',()=>{
  const f=fixture();f.c.saveChairDraft('October 2026',20,'A',0,'test');
  const p=f.c.previewChairEmail('October 2026','test');f.c.saveChairDraft('October 2026',25,'B',1,'test');
  assert.equal(f.c.sendChairReport(p.previewId,'test',p.action).success,false);assert.equal(f.emails.length,0);
  assert.match(f.c.saveChairDraft('October 2026',30,'C',1,'test').error,/Report changed/);
  const g=fixture();assert.match(g.c.previewChairEmail('October 2026','test').error,/Enter the Spent amount/);
});
test('a failed send saves nothing and a failed save after sending is clearly flagged',()=>{
  const f=chairFixture(),p=f.preview();f.quota(0);assert.equal(f.send(p).success,false);assert.equal(f.tables['Chair Reports'][1][2],'');
  f.quota(100);const g=chairFixture(),q=g.preview();g.mailHook(()=>g.failBatch(true));
  const result=g.send(q);assert.equal(result.success,false);assert.match(result.error,/accepted for sending.*NOT be saved/);assert.equal(g.mailCalls(),1);
});
test('Secretary preview is exact, requires explicit send, rejects duplicate sends and changed recipient',()=>{
  const f=fixture();f.c.saveChairDraft('October 2026',20,'Reviewed',0,'test');
  const p=f.c.previewChairEmail('October 2026','test');assert.equal(f.emails.length,0);assert.match(p.body,/Reporting month: October 2026/);
  assert.equal(f.c.sendChairReport(p.previewId,'test','send').success,true);assert.equal(f.emails[0].body,p.body);
  assert.equal(f.c.sendChairReport(p.previewId,'test','send').success,false);assert.equal(f.emails.length,1);
  const g=fixture();g.c.saveChairDraft('October 2026',0,'',0,'test');const q=g.c.previewChairEmail('October 2026','test');
  g.tables.Config[3][1]='changed@example.invalid';assert.equal(g.c.sendChairReport(q.previewId,'test','send').success,false);assert.equal(g.emails.length,0);
});

function chairFixture() {
  const f=fixture();
  f.c.saveChairDraft('October 2026',20,'Reviewed',0,'test');
  f.reportBefore=f.tables['Chair Reports'][1][1];
  f.preview=()=>f.c.previewChairEmail('October 2026','test');
  f.send=p=>f.c.sendChairReport(p.previewId,'test',p.action);
  f.email=()=>f.c.getChairReport('October 2026','test').email;
  f.assertUnchanged=()=>assert.equal(f.tables['Chair Reports'][1][1],f.reportBefore);
  return f;
}
test('known pre-send failure permits explicit retry without changing the saved draft',()=>{
  const f=chairFixture(), p=f.preview();f.quota(0);
  const result=f.send(p);assert.equal(result.success,false);assert.match(result.error,/before contacting/);
  assert.equal(f.email().status,'failed');assert.equal(f.mailCalls(),0);f.assertUnchanged();
  f.quota(100);assert.equal(f.send(p).success,false);assert.equal(f.mailCalls(),0);
  const retry=f.preview();assert.equal(retry.action,'retry');assert.notEqual(retry.previewId,p.previewId);
  assert.equal(f.c.sendChairReport(retry.previewId,'test').success,false);
  assert.equal(f.c.sendChairReport(retry.previewId,'test','resend').success,false);
  assert.equal(f.send(retry).success,true);assert.equal(f.email().status,'accepted');assert.equal(f.mailCalls(),1);f.assertUnchanged();
});
test('mail exceptions are uncertain, warn about possible sending, and permit explicit retry',()=>{
  for(const accepted of [false,true]) {
    const f=chairFixture(), p=f.preview();
    if(accepted)f.acceptThenThrow(true);else f.failMail();
    const result=f.send(p);assert.equal(result.success,false);assert.match(result.error,/may have sent.*Check sent mail/);
    assert.equal(f.email().status,'uncertain');assert.equal(f.send(p).success,false);assert.equal(f.mailCalls(),1);
    f.acceptThenThrow(false);f.failMail(false);
    const retry=f.preview();assert.equal(retry.action,'retry');assert.equal(retry.previousEmail.status,'uncertain');
    assert.equal(f.send(retry).success,true);assert.equal(f.mailCalls(),2);assert.equal(f.emails.length,accepted?2:1);f.assertUnchanged();
  }
});
test('accepted sends show date/recipient and intentional resends require fresh review and confirmation',()=>{
  const f=chairFixture(), p=f.preview();assert.equal(f.send(p).success,true);
  const first=f.email();assert.equal(first.status,'accepted');assert.ok(first.acceptedAt);assert.equal(first.recipient,'secretary@example.invalid');
  const resend=f.preview();assert.equal(resend.action,'resend');
  assert.equal(f.c.sendChairReport(resend.previewId,'test','send').success,false);assert.equal(f.mailCalls(),1);
  assert.equal(f.send(resend).success,true);assert.notEqual(f.email().attemptId,first.attemptId);assert.equal(f.mailCalls(),2);
  assert.equal(f.send(p).success,false);assert.equal(f.send(resend).success,false);assert.equal(f.mailCalls(),2);f.assertUnchanged();
});
test('different previews, concurrent requests and lost responses cannot duplicate a send',()=>{
  const f=chairFixture(), p=f.preview(), other=f.preview();let concurrent;
  f.hook(()=>concurrent=f.send(other));assert.equal(f.send(p).success,true);assert.equal(concurrent.success,false);
  assert.equal(f.send(other).success,false);assert.equal(f.send(p).success,false);assert.equal(f.mailCalls(),1);f.assertUnchanged();
  const g=chairFixture(), q=g.preview();g.loseResponse();assert.equal(g.send(q).success,false);assert.equal(g.mailCalls(),0);
  assert.equal(g.email().status,'uncertain');assert.equal(g.send(q).success,false);assert.equal(g.mailCalls(),0);
  assert.equal(g.send(g.preview()).success,true);assert.equal(g.mailCalls(),1);g.assertUnchanged();
});
test('failed or uncertain status persistence after mail never permits replay',()=>{
  for(const lostAfterWrite of [false,true]) {
    const f=chairFixture(), p=f.preview();
    f.mailHook(()=>lostAfterWrite?f.loseResponse():f.failBatch(true));
    const result=f.send(p);assert.equal(result.success,false);assert.match(result.error,/accepted for sending.*NOT be saved/);
    f.failBatch(false);f.mailHook(null);
    assert.equal(f.email().status,lostAfterWrite?'accepted':'uncertain');
    assert.equal(f.send(p).success,false);assert.equal(f.mailCalls(),1);
    assert.equal(f.send(f.preview()).success,true);assert.equal(f.mailCalls(),2);f.assertUnchanged();
  }
});
test('legacy email records support retry/resend and saving a draft preserves independent email state',()=>{
  for(const status of ['attempted','sent']) {
    const f=chairFixture();f.tables['Chair Reports'][1][4]=JSON.stringify({version:2,status,recipient:'old@example.invalid',at:'2026-09-15T12:00:00Z'});
    const p=f.preview();assert.equal(p.action,status==='sent'?'resend':'retry');assert.equal(f.send(p).success,true);f.assertUnchanged();
    const before=f.tables['Chair Reports'][1][4];
    f.c.saveChairDraft('October 2026',30,'Updated',2,'test');
    assert.equal(f.tables['Chair Reports'][1][4],before);assert.equal(f.send(p).success,false);
  }
});
test('failed resend retains previous accepted date and recipient',()=>{
  const f=chairFixture();f.send(f.preview());const accepted=f.email();f.quota(0);
  f.send(f.preview());const failed=f.email();assert.equal(failed.status,'failed');
  assert.equal(failed.lastAccepted.at,accepted.acceptedAt);assert.equal(failed.lastAccepted.recipient,accepted.recipient);f.assertUnchanged();
});
function emailUIFixture() {
  const elements={}, calls=[], prompts=[], alerts=[];let answer=true, refreshes=0;
  function el(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},disabled:false,value:id==='chair-spending'?'20':''};}
  function runner(ok,fail){return {withSuccessHandler:f=>runner(f,fail),withFailureHandler:f=>runner(ok,f),
    sendChairReport:(...args)=>calls.push({name:'send',args,ok,fail}),previewChairEmail:(...args)=>calls.push({name:'preview',args,ok,fail})};}
  const c=vm.createContext({Date,Number,String,console,setTimeout:()=>0,clearTimeout(){},reportMode:'chair',reportMonth:'November 2026',sessionToken:'test',
    esc:s=>String(s||'').replace(/</g,'&lt;'),document:{getElementById:el,querySelectorAll:()=>[]},
    confirm:p=>{prompts.push(p);return answer;},showConfirm:(p,label,yes,no)=>{prompts.push(p);if(answer)yes();else if(no)no();},alert:m=>alerts.push(m),google:{script:{get run(){return runner();}}}});
  const source=fs.readFileSync('ReportUI.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(source,c);
  c.reportMode='chair';c.reportMonth='October 2026';c.chairData={draft:{moneySpent:20,other:'',savedAt:'saved'},finalized:{version:2},revision:1};c.chairDisplay='draft';
  c.fetchSpecialReport=()=>{refreshes++;};
  return {c,elements,calls,prompts,alerts,answer:v=>answer=v,refreshes:()=>refreshes};
}
test('UI requires confirmation, suppresses double clicks and never automatically retries',()=>{
  const f=emailUIFixture();f.c.chairPreview={previewId:'attempt1',recipient:'secretary@example.invalid',action:'retry',previousEmail:{status:'uncertain'}};
  f.answer(false);f.c.sendChairUI();assert.equal(f.calls.length,0);assert.match(f.prompts[0],/may have sent.*Check sent mail/);
  f.answer(true);f.c.sendChairUI();f.c.sendChairUI();assert.equal(f.calls.length,1);assert.equal(f.elements['chair-send'].disabled,true);
  assert.equal(f.calls[0].args[2],'retry');f.calls[0].fail(Error('Connection lost'));
  assert.match(f.alerts[0],/may have sent.*Check sent mail/);assert.equal(f.refreshes(),1);
  f.c.sendChairUI();assert.equal(f.calls.length,1); // A new review is mandatory.
});
test('UI previews explicit retry/resend and shows accepted date/recipient without claiming delivery',()=>{
  const f=emailUIFixture();f.c.previewChairUI();f.calls[0].ok({success:true,previewId:'a',recipient:'secretary@example.invalid',subject:'Reviewed',body:'Final report',action:'retry',previousEmail:{status:'failed'}});
  assert.match(f.elements['chair-email-preview'].innerHTML,/>Retry Send</);assert.match(f.elements['chair-email-preview'].innerHTML,/Final report/);
  f.c.previewChairUI();f.calls[1].ok({success:true,previewId:'b',recipient:'secretary@example.invalid',subject:'Reviewed',body:'Final report',action:'resend',previousEmail:{status:'accepted',acceptedAt:'2026-09-15T12:00:00Z',recipient:'secretary@example.invalid'}});
  const html=f.elements['chair-email-preview'].innerHTML;assert.match(html,/>Resend</);assert.match(html,/Sent date \(accepted for sending\)/);assert.match(html,/Delivery is not confirmed/);
  f.c.sendChairUI();assert.match(f.prompts[0],/Intentionally resend/);assert.equal(f.calls[2].args[2],'resend');
  f.calls[2].ok({success:true,message:'Accepted for sending. Delivery is not confirmed.'});assert.match(f.alerts[0],/Delivery is not confirmed/);
});
test('UI ignores stale preview callbacks and keeps failures available for fresh review',()=>{
  const f=emailUIFixture();f.c.previewChairUI();f.c.previewChairUI();
  const preview={success:true,previewId:'fresh',recipient:'secretary@example.invalid',subject:'Report',body:'Finished report',action:'send'};
  f.calls[1].ok(preview);f.calls[0].ok({...preview,previewId:'stale'});assert.equal(f.c.chairPreview.previewId,'fresh');
  f.c.sendChairUI();f.calls[2].ok({success:false,error:'Send failed before contacting the email service.'});assert.equal(f.refreshes(),1);assert.match(f.alerts[0],/Send failed/);
  f.c.sendChairUI();assert.equal(f.calls.length,3);
});

test('all Orders views export the selected period, group and matching rows with annual breakdown',()=>{
  const f=fixture();f.ready(3);
  f.tables.Orders.push(['OTHER','','October 2026','Other Group','','','',100,100,'Completed','',0]);
  f.tables['Order Items'].push(['OTHER-01','OTHER','B2','Other item',100,1,1,100]);
  const ui=emailUIFixture();let printed,exported;
  ui.c.printReportPage=(title,html)=>{printed={title,html};};ui.c.downloadReportCSV=(title,rows)=>{exported={title,rows};};
  for(const period of ['monthly','annual'])for(const view of ['group','item']){
    const selected=period==='monthly'?'October 2026':'2026';
    ui.c.ordersReportData=f.c.getOrdersReport(period,selected,'Group A','test');ui.c.reportPeriod=period;ui.c.reportView=view;ui.c.reportYear='2026';ui.c.reportGroup='Group A';
    ui.c.renderOrdersControls();ui.c.renderOrdersResults();ui.c.printOrdersReport();ui.c.exportOrdersCSV();
    assert.match(ui.elements['report-controls'].innerHTML,/Period/);assert.match(ui.elements['report-controls'].innerHTML,/By Group/);assert.match(ui.elements['report-controls'].innerHTML,/By Item/);
    assert.match(printed.html,/NORVANA/);assert.ok(printed.html.includes(selected));assert.match(printed.html,/Group A/);assert.doesNotMatch(printed.html,/Other Group|Other item/);
    assert.ok(exported.title.includes(view==='group'?'By Group':'By Item'));assert.equal(exported.rows[1][1],selected);assert.equal(exported.rows[2][1],'Group A');
    assert.equal(exported.rows[3][1],0);assert.equal(exported.rows[4][1],30);assert.equal(exported.rows[5][1],50);
    assert.equal(printed.html.includes('Monthly breakdown'),period==='annual');
    assert.equal(exported.rows.some(r=>r[0]==='Monthly breakdown'),period==='annual');
    if(view==='item'){assert.match(printed.html,/Fulfilled Value/);assert.ok(exported.rows.some(r=>r[0]==='Book'&&r[1]===5&&r[2]===3&&r[3]==='$50.00'&&r[4]==='$30.00'));}
  }
});

test('Inventory print and CSV contain only Item and Count plus NORVANA and stock date',()=>{
  const ui=emailUIFixture();let printed,exported;
  ui.c.inventoryReportData={stockAsOf:'2026-10-10T12:00:00Z',items:[{name:'Book',stock:-2},{name:'Inactive item',stock:0}]};
  ui.c.printReportPage=(title,html)=>printed=html;ui.c.downloadReportCSV=(title,rows)=>exported=rows;
  ui.c.renderInventoryReport();ui.c.selectInventoryReportCategory('Other');ui.c.printInventoryReport();ui.c.exportInventoryCSV();
  assert.match(printed,/NORVANA/);assert.match(printed,/Stock as of/);assert.equal((printed.match(/<th>/g)||[]).length,2);assert.doesNotMatch(printed,/Requested|Fulfilled|demand|month selector/i);
  assert.equal(exported[0][0],'NORVANA');assert.equal(exported[1][1],'2026-10-10T12:00:00Z');assert.equal(exported[3].join(','),'Item,Count');assert.equal(exported[4][1],-2);assert.ok(exported.slice(3).every(r=>r.length===2));
});

test('Inventory report defaults to all categories and a selected category keeps screen, print and CSV scoped to the same items',()=>{
  const ui=emailUIFixture();let printed;
  ui.c.inventoryReportData={stockAsOf:'2026-10-10T12:00:00Z',items:[{name:'Book',category:'Books',stock:-2},{name:'Welcome',category:'Keytags',stock:5}]};
  ui.c.printReportPage=(title,html)=>printed=html;
  ui.c.renderInventoryReport();assert.equal(ui.c.inventoryReportCategory,null);
  assert.match(ui.elements['report-controls'].innerHTML,/All categories/);
  assert.match(ui.elements['report-panel'].innerHTML,/Book/);assert.match(ui.elements['report-panel'].innerHTML,/Welcome/);
  ui.c.printInventoryReport();assert.match(printed,/Inventory - All categories/);assert.match(printed,/Book/);assert.match(printed,/Welcome/);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.c.inventoryCSVRows().slice(3))),[['Category','Item','Count'],['Books','Book',-2],['Keytags','Welcome',5]]);
  ui.c.selectInventoryReportCategory('Keytags');ui.c.printInventoryReport();
  assert.match(ui.elements['report-panel'].innerHTML,/Welcome/);assert.doesNotMatch(ui.elements['report-panel'].innerHTML,/Book/);
  assert.match(printed,/Inventory - Keytags/);assert.doesNotMatch(printed,/Book/);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.c.inventoryCSVRows().slice(4))),[['Welcome',5]]);
  ui.c.selectInventoryReportCategory('');assert.equal(ui.c.inventoryReportCategory,null);
});

test('Chair summary strip leads the controls; autosave replaces Save and Finalize; selected version determines print and email',()=>{
  const ui=emailUIFixture();let printed;
  const draft={reportingMonth:'October 2026',groupsServed:2,moneyCollected:30,hiCharged:4,moneySpent:20,other:'Draft notes',savedAt:'today'};
  ui.c.chairData={draft,live:draft,finalized:{...draft,moneySpent:10,other:'Sent notes',version:4,sentAt:'2026-11-05T12:00:00Z'},revision:4};ui.c.chairDisplay='final';
  ui.c.printReportPage=(title,html)=>printed=html;ui.c.renderReportsShell();ui.c.renderChairReport();
  const shell=ui.elements['reports-content'].innerHTML;assert.ok(shell.indexOf('report-controls')<shell.indexOf('report-panel'));
  const controls=ui.elements['report-controls'].innerHTML;
  assert.ok(controls.indexOf('Groups served')<controls.indexOf('Reporting month'));assert.ok(controls.indexOf('Collected')<controls.indexOf('Reporting month'));
  assert.ok(controls.indexOf('Reporting month')<controls.indexOf('Spent'));assert.ok(controls.indexOf('Spent')<controls.indexOf('Notes'));
  assert.doesNotMatch(controls,/Save Draft|Finalize|Update Final|regional order/i);
  assert.equal((ui.elements['report-panel'].innerHTML.match(/class="chair-paper"/g)||[]).length,1);assert.doesNotMatch(ui.elements['report-panel'].innerHTML,/Secretary:|Presentation|November|Unsaved changes/);
  ui.c.printChairUI();assert.match(printed,/Sent version 4/);assert.match(printed,/Sent notes/);assert.doesNotMatch(printed,/Draft notes/);
  ui.c.showChairVersion('draft');ui.c.printChairUI();assert.match(printed,/Current report/);assert.match(printed,/Draft notes/);assert.doesNotMatch(printed,/Sent notes/);
  ui.c.showChairVersion('final');ui.c.previewChairUI();assert.equal(ui.calls.length,0);
  ui.c.showChairVersion('draft');
  ui.c.document.getElementById('chair-spending').value='25';ui.c.document.getElementById('chair-notes').value='Edited notes';ui.c.chairEdited();
  assert.equal(ui.elements['chair-unsaved'].textContent,'Saving...');ui.c.printChairUI();assert.match(printed,/25\.00/);
  ui.c.document.getElementById('chair-spending').value='';ui.c.chairEdited();assert.match(ui.elements['chair-unsaved'].textContent,/Enter an amount/);
  ui.c.document.getElementById('chair-spending').value='20';ui.c.document.getElementById('chair-notes').value='Draft notes';ui.c.chairEdited();assert.equal(ui.c.chairDirty,false);assert.equal(ui.elements['chair-unsaved'].textContent,'Saved');
});
test('autosave stores Spent and Notes, keeps typing queued, and flags failures',()=>{
  const ui=emailUIFixture(),saves=[];
  ui.c.google={script:{get run(){const r=(ok,fail)=>({withSuccessHandler:f=>r(f,fail),withFailureHandler:f=>r(ok,f),saveChairDraft:(...a)=>saves.push({a,ok,fail})});return r();}}};
  ui.c.chairData={draft:{reportingMonth:'October 2026',moneySpent:20,other:'',savedAt:'saved'},revision:1};
  ui.c.document.getElementById('chair-spending').value='30';ui.c.chairEdited();
  ui.c.chairAutosave();assert.equal(saves.length,1);assert.equal(saves[0].a[1],30);assert.equal(saves[0].a[3],1);
  ui.c.document.getElementById('chair-notes').value='more';ui.c.chairEdited();ui.c.chairAutosave();assert.equal(saves.length,1);
  saves[0].ok({success:true,revision:2,savedAt:'t2'});assert.equal(saves.length,2);assert.equal(saves[1].a[3],2);assert.equal(saves[1].a[2],'more');
  saves[1].ok({success:false,error:'Report changed. Reload before saving.'});
  assert.match(ui.elements['chair-unsaved'].textContent,/NOT SAVED.*Report changed/);assert.equal(ui.elements['chair-unsaved'].style.color,'#b3261e');
});
test('leaving a Chair Report saves first and only asks in-page when a change could not be saved',()=>{
  const ui=emailUIFixture();let left=0;
  ui.c.fetchReport=()=>{left++;};ui.c.chairDirty=true;
  ui.c.onReportMonthChange('2026-11');assert.equal(left,1);assert.equal(ui.prompts.length,0);assert.equal(ui.c.reportMonth,'November 2026');
  ui.c.reportMonth='October 2026';ui.c.chairDirty=true;ui.c.document.getElementById('chair-spending').value='';
  ui.answer(false);ui.c.onReportMonthChange('2026-11');
  assert.equal(left,1);assert.match(ui.prompts[0],/could not be saved/);assert.equal(ui.elements['report-month'].value,'2026-10');
  ui.answer(true);ui.c.onReportMonthChange('2026-11');assert.equal(left,2);assert.equal(ui.c.reportMonth,'November 2026');
  ui.c.chairDirty=false;ui.c.setReportMode('inventory');assert.equal(left,3);
});
test('manual ordering window includes final millisecond of meeting day in New York',()=>{
  const f=fixture();const NativeDate=Date;
  function at(iso){ f.c.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[iso]));} static [Symbol.hasInstance](v){return v instanceof NativeDate;}};return f.c.getCurrentWindow(); }
  assert.equal(at('2026-09-04T03:59:59.999Z').isOpen,false);
  assert.equal(at('2026-09-04T04:00:00Z').meetingMonth,'October 2026');
  assert.equal(at('2026-10-02T03:59:59.999Z').meetingMonth,'October 2026');
  assert.equal(at('2026-10-02T04:00:00Z').meetingMonth,'November 2026');
});
test('public submission ignores negative stock and client month; deleted IDs are not reused',()=>{
  const f=fixture(), NativeDate=Date;
  f.c.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:['2026-10-02T03:59:59.999Z']));} static [Symbol.hasInstance](v){return v instanceof NativeDate;}};
  f.c.deleteOrder(f.oid,'test',0);
  f.c.updateStockCounts([{itemId:'B1',stock:-10}],'test');
  const result=f.c.submitOrder({groupName:'Group A',contactName:'Test',email:'group@example.invalid',meetingMonth:'December 2030',items:[{itemId:'B1',qty:2},{itemId:'B2',qty:5}]});
  assert.equal(result.success,true);assert.equal(result.orderId,'NL-2610-002');assert.equal(f.tables.Orders[1][2],'October 2026');assert.equal(f.stock(),-10);assert.equal(f.tables['Order Items'].length,2);
});
test('concurrent reopen and delete are serialized; lost delete response cannot restore twice',()=>{
  const f=fixture();f.ready(4);let concurrent;
  f.hook(()=>concurrent=f.c.deleteOrder(f.oid,'test',1));
  assert.equal(f.c.reopenOrder(f.oid,'test',1).success,true);assert.equal(concurrent.success,false);assert.equal(f.stock(),2);
  f.ready(3);f.loseResponse();assert.equal(f.c.deleteOrder(f.oid,'test',3).success,false);assert.equal(f.stock(),2);
  assert.equal(f.c.deleteOrder(f.oid,'test',3).success,true);assert.equal(f.stock(),2);
});
function openWindow(f){
  const NativeDate=Date;
  f.c.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:['2026-09-20T16:00:00.000Z']));} static [Symbol.hasInstance](v){return v instanceof NativeDate;}};
}
const order=(over={})=>Object.assign({groupName:'Group A',contactName:'Pat',email:'pat@example.invalid',phone:'555-0100',requestId:'req-00000001',items:[{itemId:'B1',qty:2}]},over);
const lastOrder=f=>f.tables.Orders[f.tables.Orders.length-1];

test('order text is stored literally: formulas never reach the sheet as formulas',()=>{
  const f=fixture();openWindow(f);
  const r=f.c.submitOrder(order({contactName:'=IMPORTRANGE("abc","Config!A1")',phone:'+SUM(1,1)',email:'a@b.co'}));
  assert.equal(r.success,true);
  assert.equal(lastOrder(f)[4],'=IMPORTRANGE("abc","Config!A1")');assert.equal(lastOrder(f)[6],'+SUM(1,1)');
  // The visitor's text is never handed to appendRow (which would let Sheets evaluate it); it is written afterwards as string values.
  f.appendLog.filter(a=>a.sheet==='Orders').forEach(a=>assert.equal(JSON.stringify(a.row.slice(3,7)),JSON.stringify(['','','',''])));
  assert.equal(f.emails.length,2);
});

test('group must be on the Groups list; junk, control characters and oversize input are handled',()=>{
  const f=fixture();openWindow(f);
  const before=f.tables.Orders.length;
  assert.equal(f.c.submitOrder(order({groupName:'Not A Group'})).success,false);
  assert.equal(f.c.submitOrder(order({groupName:'=1+1'})).success,false);
  assert.equal(f.c.submitOrder(order({email:'x'.repeat(300)+'@b.co'})).success,false);
  assert.equal(f.c.submitOrder(order({items:Array.from({length:101},()=>({itemId:'B1',qty:1}))})).success,false);
  assert.equal(f.c.submitOrder(null).success,false);assert.equal(f.c.submitOrder({items:'B1'}).success,false);
  assert.equal(f.tables.Orders.length,before);
  const ok=f.c.submitOrder(order({groupName:'  Group   A ',contactName:'Pat\nQ\u0000'+'z'.repeat(200)}));
  assert.equal(ok.success,true);assert.equal(lastOrder(f)[3],'Group A');
  assert.doesNotMatch(lastOrder(f)[4],/[\u0000-\u001f]/);assert.ok(lastOrder(f)[4].length<=100);
});

test('item lines: catalog membership by own key, repeated items merged, bad quantities dropped, per-item cap',()=>{
  const f=fixture();openWindow(f);
  assert.equal(f.c.submitOrder(order({items:[{itemId:'constructor',qty:1},{itemId:'__proto__',qty:1},{itemId:'toString',qty:1},{itemId:'B2',qty:3}]})).success,false);
  const r=f.c.submitOrder(order({requestId:'req-00000002',items:[{itemId:'B1',qty:2},{itemId:'B1',qty:3},{itemId:'B1',qty:Infinity},{itemId:'B1',qty:NaN},{itemId:'B1',qty:-4},{itemId:'B1',qty:'x'}]}));
  assert.equal(r.success,true);
  const lines=f.tables['Order Items'].filter(l=>l[1]===r.orderId);
  assert.equal(lines.length,1);assert.equal(lines[0][5],5);assert.equal(lastOrder(f)[7],495); // 5 x server price 99, not anything the browser sent
  
  const big=f.c.submitOrder(order({requestId:'req-00000003',items:[{itemId:'B1',qty:600},{itemId:'B1',qty:600}]}));
  assert.equal(f.tables['Order Items'].filter(l=>l[1]===big.orderId)[0][5],999);
});

test('repeating the same order (lost response, double tap) returns the original instead of a second order',()=>{
  const f=fixture();openWindow(f);
  const first=f.c.submitOrder(order()), orders=f.tables.Orders.length, mails=f.emails.length;
  const again=f.c.submitOrder(order());
  assert.equal(again.orderId,first.orderId);assert.equal(f.tables.Orders.length,orders);assert.equal(f.emails.length,mails);
  const changed=f.c.submitOrder(order({items:[{itemId:'B1',qty:9}]}));
  assert.equal(changed.success,true);assert.notEqual(changed.orderId,first.orderId);
});

test('flooding one email address is limited; other people are unaffected',()=>{
  const f=fixture();openWindow(f);
  for(let i=1;i<=5;i++)assert.equal(f.c.submitOrder(order({requestId:'req-flood-'+i,items:[{itemId:'B1',qty:i}]})).success,true);
  const blocked=f.c.submitOrder(order({requestId:'req-flood-6',items:[{itemId:'B1',qty:6}]}));
  assert.equal(blocked.success,false);assert.match(blocked.error,/Lit Chair/);
  assert.equal(f.c.submitOrder(order({requestId:'req-other-1',email:'someone.else@example.invalid'})).success,true);
});

test('a failed write leaves no half-saved order and consumes no stock; retry works',()=>{
  const f=fixture();openWindow(f);
  const orders=f.tables.Orders.length,items=f.tables['Order Items'].length;
  f.failBatch(true);
  const bad=f.c.submitOrder(order());
  assert.equal(bad.success,false);assert.equal(f.tables.Orders.length,orders);assert.equal(f.tables['Order Items'].length,items);assert.equal(f.emails.length,0);
  f.failBatch(false);
  const good=f.c.submitOrder(order());
  assert.equal(good.success,true);assert.equal(f.tables.Orders.length,orders+1);assert.equal(f.emails.length,2);
});

test('confirmation emails are sent after the order lock is released',()=>{
  const f=fixture();openWindow(f);let freeDuringMail=null;
  f.mailHook(()=>{const l=f.c.LockService.getScriptLock();freeDuringMail=l.tryLock();l.releaseLock();});
  assert.equal(f.c.submitOrder(order()).success,true);assert.equal(freeDuringMail,true);
});

test('dashboard login: right code signs in, token works, short code is flagged, session lifetime respects the 6 hour cache limit',()=>{
  const f=fixture();
  const ok=f.c.checkAccessCode('test');
  assert.equal(ok.valid,true);assert.equal(ok.weakCode,true);
  assert.equal(f.c.getSettings(ok.token).email,'chair@example.invalid');
  assert.equal(f.c.getSettings('not-a-token').error,'Unauthorized');
  assert.equal(f.c.getSettings(undefined).error,'Unauthorized');
  assert.ok(require('node:vm').runInContext('TOKEN_TTL_SECONDS',f.c)<=21600);
  assert.equal(f.c.checkAccessCode(undefined).valid,false);assert.equal(f.c.checkAccessCode(1234).valid,false);
});

test('dashboard login: repeated wrong guesses lock everyone out briefly, right or wrong; success resets the count',()=>{
  const f=fixture();
  for(let i=0;i<9;i++)assert.equal(f.c.checkAccessCode('nope'+i).valid,false);
  assert.equal(f.c.checkAccessCode('test').valid,true); // 9 misses are not a lockout, and a success resets the count
  for(let i=0;i<9;i++)f.c.checkAccessCode('again'+i);
  assert.equal(f.c.checkAccessCode('test').valid,true);
  for(let i=0;i<10;i++)f.c.checkAccessCode('wrong'+i);
  const locked=f.c.checkAccessCode('test');
  assert.equal(locked.valid,false);assert.equal(locked.token,undefined);assert.match(locked.message,/Too many incorrect attempts.*minute/);
  assert.equal(f.c.checkAccessCode('wrong-again').valid,false);
});

test('dashboard login refuses a missing or default access code instead of falling back to it',()=>{
  for(const bad of ['changeme','ChangeMe','','  ']){
    const f=fixture();f.tables.Config[1][1]=bad;
    const r=f.c.checkAccessCode(bad||'changeme');
    assert.equal(r.valid,false);assert.match(r.message,/not set up/);
  }
  const f=fixture();f.tables.Config.splice(1,1);
  assert.equal(f.c.checkAccessCode('changeme').valid,false);assert.equal(f.c.checkAccessCode('').valid,false);
});

test('settings never send the access code to the browser',()=>{
  const f=fixture();const token=f.c.checkAccessCode('test').token;
  const settings=f.c.getSettings(token);
  assert.equal(settings.accessCode,undefined);assert.equal(settings.codeIsSet,true);
  assert.doesNotMatch(JSON.stringify(settings),/"test"/);
});

test('changing the access code signs out every other session; blank keeps the code; short codes are rejected',()=>{
  const f=fixture();
  const a=f.c.checkAccessCode('test').token, stolen=f.c.checkAccessCode('test').token;
  assert.equal(f.c.saveGlobalSettings('','chair2@example.invalid',a,'').success,true);
  assert.equal(f.tables.Config[1][1],'test');assert.equal(f.tables.Config[2][1],'chair2@example.invalid');
  assert.equal(f.c.getSettings(stolen).email,'chair2@example.invalid'); // no code change: sessions untouched
  assert.equal(f.c.saveGlobalSettings('abc','chair@example.invalid',a,'').success,false);
  assert.equal(f.c.saveGlobalSettings('changeme','chair@example.invalid',a,'').success,false);
  assert.equal(f.tables.Config[1][1],'test');
  const saved=f.c.saveGlobalSettings('a-much-longer-code','chair@example.invalid',a,'');
  assert.equal(saved.success,true);assert.ok(saved.newToken);assert.equal(f.tables.Config[1][1],'a-much-longer-code');
  assert.equal(f.c.getSettings(stolen).error,'Unauthorized');assert.equal(f.c.getSettings(a).error,'Unauthorized');
  assert.equal(f.c.getSettings(saved.newToken).email,'chair@example.invalid');
  assert.equal(f.c.checkAccessCode('test').valid,false);
  const again=f.c.checkAccessCode('a-much-longer-code');assert.equal(again.valid,true);assert.equal(again.weakCode,false);
});

test('a refreshed page resumes with its session token only; signed-out or unknown tokens do not',()=>{
  const f=fixture();const token=f.c.checkAccessCode('test').token;
  const r=f.c.resumeSession(token);assert.equal(r.valid,true);assert.equal(r.token,token);assert.ok(r.meetingMonth);
  f.c.signOut(token);assert.equal(f.c.resumeSession(token).valid,false);
  assert.equal(f.c.resumeSession('made-up').valid,false);assert.equal(f.c.resumeSession().valid,false);
});

test('all source scripts parse',()=>{
  for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.gs')))new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
  for(const file of ['App.html','ReportUI.html'])for(const m of fs.readFileSync(file,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1],{filename:file});
});
test('UI renders inventory, fulfillment stock, Secretary setting and both report views',()=>{
  const elements={};
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},contains(){return false;},toggle(){}},insertAdjacentHTML(where,s){this.innerHTML+=s;},value:'3'};}
  const storage={getItem:()=>null,setItem(){},removeItem(){}};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,setTimeout:()=>0,clearTimeout(){},alert(){},localStorage:storage,sessionStorage:storage,
    window:{addEventListener(){},scrollTo(){}},document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},google:{script:{run:{}}}});
  for(const file of ['App.html','ReportUI.html'])for(const m of fs.readFileSync(file,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c);
  vm.runInContext(`renderInventory([{itemId:'B1',category:'Books',name:'Book',stock:-2,price:10,active:true}]);`,c);
  assert.match(elements['inventory-content'].innerHTML,/View Inventory Report/);assert.match(elements['inventory-content'].innerHTML,/inv-field-label">Count</);assert.match(elements['inventory-content'].innerHTML,/inv-price-ro">\$10\.00/);assert.doesNotMatch(elements['inventory-content'].innerHTML,/inv-price-input|Save Stock/);assert.match(elements['inventory-content'].innerHTML,/aria-label="Edit price for Book"/);assert.match(elements['inventory-content'].innerHTML,/value="-2"/);
  vm.runInContext(`allOrders=[{orderId:'O',status:'Ready',estimatedTotal:50,groupName:'A'}];currentOrderId='O';renderOrderPanel({status:'Ready',revision:1,items:[{orderId:'O',rowId:'O-01',sheetRow:2,name:'Book',category:'Books',price:10,qtyOrdered:5,qtyFulfilled:3,stock:-2}]});`,c);
  assert.match(elements['panel-body'].innerHTML,/Available: -2/);assert.match(elements['panel-body'].innerHTML,/Reopen for editing/);
  vm.runInContext(`renderSettings({codeIsSet:true,email:'chair@example.invalid',secretaryEmail:'secretary@example.invalid',schedule:[]},[]);`,c);
  assert.match(elements['settings-content'].innerHTML,/Secretary Email/);
  vm.runInContext(`inventoryReportData={meetingMonth:'October 2026',stockAsOf:'2026-10-10',items:[{name:'Book',groups:2,qtyOrdered:10,qtyFulfilled:3,unfilled:2,awaiting:5,stock:-2}]};renderInventoryReport();`,c);
  assert.match(elements['report-panel'].innerHTML,/<th>Item<\/th><th>Count<\/th>/);assert.doesNotMatch(elements['report-panel'].innerHTML,/demand|fulfillment|Ordering month/i);
  vm.runInContext(`const r={presentationMonth:'November 2026',reportingMonth:'October 2026',groupsServed:2,moneyCollected:30,moneySpent:20,other:'<script>unsafe</scr'+'ipt>',savedAt:'today'};chairData={draft:r,live:r,finalized:{...r,version:2},revision:2,secretaryEmail:'secretary@example.invalid'};renderChairReport();`,c);
  assert.match(elements['report-controls'].innerHTML,/Groups served/);assert.match(elements['report-panel'].innerHTML,/&lt;script&gt;/);assert.doesNotMatch(elements['report-panel'].innerHTML,/orders awaiting pickup|completed-order counts/i);
});

// -- H&I Subcommittee: its own items, no Keytags/Medallions, paid from a budget instead of collected --
function hiFixture(){
  const f=fixture();openWindow(f);
  f.tables.Groups.push(['H&I Subcommittee']);
  f.tables.Catalog.push(['K1','Keytags','Keytag',1,0,'YES'],['M1','Medallions','Medallion',3,0,'YES'],['1500H&I','H&I','NA White Booklet: H&I Edition',0.92,0,'YES']);
  return f;
}
const HI='H&I Subcommittee';

test('H&I-only items are refused for other groups; Keytags and Medallions are refused for H&I',()=>{
  const f=hiFixture(), before=f.tables.Orders.length;
  const normal=f.c.submitOrder(order({items:[{itemId:'B1',qty:1},{itemId:'1500H&I',qty:1}]}));
  assert.equal(normal.success,false);assert.match(normal.error,/not available/);
  for(const id of ['K1','M1']){
    const r=f.c.submitOrder(order({groupName:HI,requestId:'req-hi-'+id,items:[{itemId:'B1',qty:1},{itemId:id,qty:1}]}));
    assert.equal(r.success,false);assert.match(r.error,/not available/);
  }
  assert.equal(f.tables.Orders.length,before);assert.equal(f.emails.length,0);
  // Allowed combinations: H&I can order its own items alongside regular ones; other groups can still order Keytags.
  const hi=f.c.submitOrder(order({groupName:HI,requestId:'req-hi-ok',items:[{itemId:'B1',qty:2},{itemId:'1500H&I',qty:3}]}));
  assert.equal(hi.success,true);assert.equal(f.tables['Order Items'].filter(l=>l[1]===hi.orderId).length,2);
  assert.equal(f.c.submitOrder(order({requestId:'req-key-ok',items:[{itemId:'K1',qty:1}]})).success,true);
});

test('form data carries the H&I rules and each catalog line carries its pack size',()=>{
  const f=hiFixture();f.tables.Catalog[1][7]=5;
  const d=f.c.getFormData();
  assert.equal(d.hiRules.group,HI);assert.deepEqual(Array.from(d.hiRules.onlyCategories),['H&I']);assert.deepEqual(Array.from(d.hiRules.hiddenCategories),['Keytags','Medallions']);
  assert.equal(d.catalog.find(i=>i.itemId==='B1').packSize,5);assert.equal(d.catalog.find(i=>i.itemId==='K1').packSize,1);
});

test('H&I emails say it is charged to the budget; other groups keep the cash/check wording',()=>{
  const f=hiFixture();
  const hi=f.c.submitOrder(order({groupName:HI,requestId:'req-hi-mail',email:'hi@example.invalid',items:[{itemId:'B1',qty:1}]}));
  const confirm=f.emails.find(e=>e.to==='hi@example.invalid'), alert=f.emails.find(e=>e.to==='chair@example.invalid');
  assert.match(confirm.body,/charged to the H&I subcommittee budget/);assert.doesNotMatch(confirm.body,/final amount due/);
  assert.match(alert.body,/PAID BY: H&I subcommittee budget/);
  f.emails.length=0;
  const normal=f.c.submitOrder(order({items:[{itemId:'B1',qty:1}]}));
  assert.match(f.emails.find(e=>e.to==='pat@example.invalid').body,/final amount due/);assert.doesNotMatch(f.emails.find(e=>e.to==='chair@example.invalid').body,/PAID BY/);
  // Ready notices
  f.emails.length=0;
  const rowId=id=>id+'-01';
  assert.equal(f.c.fulfillOrder(hi.orderId,[{rowId:rowId(hi.orderId),qtyFulfilled:1}],10,'test',0).success,true);
  const ready=f.emails.pop();assert.match(ready.body,/CHARGED TO THE H&I SUBCOMMITTEE BUDGET: \$99\.00/);assert.match(ready.body,/No payment is needed at pickup/);assert.doesNotMatch(ready.body,/cash\/check|DUE AT PICKUP/);
  assert.equal(f.c.fulfillOrder(normal.orderId,[{rowId:rowId(normal.orderId),qtyFulfilled:1}],10,'test',0).success,true);
  const cash=f.emails.pop();assert.match(cash.body,/FINAL AMOUNT DUE AT PICKUP: \$99\.00/);assert.match(cash.body,/bring cash\/check payment/);assert.doesNotMatch(cash.body,/H&I/);
});

test('H&I Completed orders are reported as charged to the budget, not collected',()=>{
  const f=hiFixture();
  f.tables.Orders.push(['NL-2610-002','','October 2026',HI,'','','',20,12,'Completed','',0],['NL-2610-003','','October 2026','Group B','','','',40,30,'Completed','',0],['NL-2610-004','','October 2026',HI,'','','',8,8,'Ready','',0]);
  f.tables['Order Items'].push(['NL-2610-002-01','NL-2610-002','B1','Book',10,2,1,10],['NL-2610-003-01','NL-2610-003','B1','Book',10,4,3,30],['NL-2610-004-01','NL-2610-004','B1','Book',10,1,1,8]);
  const r=f.c.getOrdersReport('monthly','October 2026','','test');
  assert.equal(r.totals.collected,30);assert.equal(r.totals.charged,12);
  assert.equal(r.byGroup.find(g=>g.groupName===HI).charged,12);assert.equal(r.byGroup.find(g=>g.groupName===HI).collected,0);
  assert.equal(r.byGroup.find(g=>g.groupName==='Group B').charged,0);
  const o=r.orders.find(x=>x.orderId==='NL-2610-002');assert.equal(o.charged,12);assert.equal(o.collected,0);
  assert.equal(f.c.getOrdersReport('monthly','October 2026',HI,'test').totals.collected,0);
});

test('Chair Report keeps cash collected apart from H&I charged; old snapshots are untouched',()=>{
  const f=hiFixture();
  f.tables.Orders.push(['NL-2610-002','','October 2026',HI,'','','',20,12,'Completed','',0],['NL-2610-003','','October 2026','Group B','','','',40,30,'Completed','',0]);
  const live=f.c.getChairReport('November 2026','test').live;
  assert.equal(live.moneyCollected,30);assert.equal(live.hiCharged,12);assert.equal(live.groupsServed,2);
  assert.equal(f.c.saveChairDraft('November 2026',5,'',0,'test').success,true);
  assert.match(f.c.previewChairEmail('November 2026','test').body,/Collected: \$30\.00\nH&I charged to subcommittee budget: \$12\.00\nSpent: \$5\.00/);
  // A version sent before this feature has no hiCharged and is left exactly as saved.
  const g=fixture();const legacy={reportingMonth:'October 2026',groupsServed:7,moneyCollected:123.45,moneySpent:90,other:'',version:9};
  g.tables['Chair Reports'].push(['October 2026',JSON.stringify(legacy),JSON.stringify(legacy),9,'']);
  assert.equal(g.c.getChairReport('October 2026','test').finalized.hiCharged,undefined);assert.equal(g.c.getChairReport('October 2026','test').finalized.moneyCollected,123.45);
});

test('order form: H&I group gets its own tab first and no Keytags/Medallions; switching groups clears quantities',()=>{
  const elements={};
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},contains(){return false;},toggle(){}},insertAdjacentHTML(where,s){this.innerHTML+=s;},value:''};}
  const storage={getItem:()=>null,setItem(){},removeItem(){}};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,setTimeout:()=>0,clearTimeout(){},alert(){},localStorage:storage,sessionStorage:storage,
    window:{addEventListener(){},scrollTo(){}},document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},google:{script:{run:{}}}});
  for(const file of ['App.html','ReportUI.html'])for(const m of fs.readFileSync(file,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c);
  const tabs=()=>Array.from(elements['cat-wrap'].innerHTML.matchAll(/id="cattab-([^"]+)"/g),m=>m[1].replace(/&amp;/g,'&'));
  vm.runInContext(`hiRules={group:'H&I Subcommittee',onlyCategories:['H&I'],hiddenCategories:['Keytags','Medallions']};
    catalog=[{itemId:'B1',category:'Books',name:'Book',price:10},{itemId:'K1',category:'Keytags',name:'Keytag',price:1},{itemId:'M1',category:'Medallions',name:'Medal',price:3},
      {itemId:'SP1',category:'Spanish Lit',name:'Spanish',price:2},{itemId:'SO1',category:'Special Orders',name:'Special',price:4},{itemId:'1500H&I',category:'H&I',name:'Booklet',price:0.92,packSize:5}];
    initForm(['Group A','H&I Subcommittee']);`,c);
  assert.deepEqual(tabs(),['Books','Keytags','Medallions','Special Orders','Spanish Lit']);
  elements['group-name'].value='H&I Subcommittee';vm.runInContext('onGroupChange();',c);
  assert.deepEqual(tabs(),['H&I','Books','Special Orders','Spanish Lit']);
  assert.equal(vm.runInContext('activeCat',c),'H&I');assert.match(elements['cat-wrap'].innerHTML,/pack of 5/);
  vm.runInContext(`changeQty('1500H&I',2);changeQty('B1',1);`,c);assert.equal(elements['subtotal-amount'].textContent,'$11.84');
  elements['group-name'].value='Group A';vm.runInContext('onGroupChange();',c);
  assert.deepEqual(tabs(),['Books','Keytags','Medallions','Special Orders','Spanish Lit']);
  assert.equal(vm.runInContext('qtys["1500H&I"]',c),0);assert.equal(vm.runInContext('qtys.B1',c),1);assert.equal(elements['subtotal-amount'].textContent,'$10.00');
  assert.doesNotMatch(elements['cat-wrap'].innerHTML,/H&amp;I|1500/);
  assert.match(fs.readFileSync('App.html','utf8'),/placeholder="First name and last initial \(e\.g\. John D\.\)"/);
});

test('Ready emails no longer tell groups that unfilled quantities do not carry forward',()=>{
  const f=hiFixture();
  const normal=f.c.submitOrder(order({items:[{itemId:'B1',qty:1}]})),hi=f.c.submitOrder(order({groupName:HI,requestId:'req-hi-nocf',items:[{itemId:'B1',qty:1}]}));
  for(const o of [normal,hi]){
    f.emails.length=0;assert.equal(f.c.fulfillOrder(o.orderId,[{rowId:o.orderId+'-01',qtyFulfilled:1}],10,'test',0).success,true);
    const body=f.emails.pop().body;assert.doesNotMatch(body,/Unfilled|carry forward|next month/);assert.match(body,/Questions\? Contact chair@example\.invalid/);
  }
});

test('emails carry a styled HTML version with the inline logo; plain text stays, content is escaped, styling can never block sending',()=>{
  const f=hiFixture();
  const r=f.c.submitOrder(order({groupName:HI,requestId:'req-style-1',contactName:'<b>Pat</b> & "Q"',items:[{itemId:'B1',qty:2},{itemId:'1500H&I',qty:1}]}));
  assert.equal(r.success,true);
  const confirm=f.emails.find(e=>e.to==='pat@example.invalid'),alert=f.emails.find(e=>e.to==='chair@example.invalid');
  for(const e of [confirm,alert]){
    assert.ok(e.body.length>50);assert.match(e.htmlBody,/^<!DOCTYPE html>/);assert.match(e.htmlBody,/src="cid:norvanalogo"/);
    const png=e.inlineImages.norvanalogo;assert.equal(png.type,'image/png');assert.deepEqual(png.bytes.slice(0,4),[0x89,0x50,0x4e,0x47]);
  }
  assert.doesNotMatch(alert.htmlBody,/<b>Pat/);assert.match(alert.htmlBody,/&lt;b&gt;Pat&lt;\/b&gt; &amp; &quot;Q&quot;/);
  assert.match(confirm.htmlBody,/You asked/);assert.match(confirm.htmlBody,/NL-2610-002/);assert.match(confirm.htmlBody,/charged to the H&amp;I subcommittee budget/);
  assert.match(alert.htmlBody,/Someone needs/);assert.match(alert.htmlBody,/NL-2610-002/);assert.match(alert.htmlBody,/1500H&amp;I/);assert.match(alert.htmlBody,/pat@example\.invalid/);
  // Pickup notice: normal group shows the payment box, H&I shows the budget box.
  const normal=f.c.submitOrder(order({requestId:'req-style-2',items:[{itemId:'B1',qty:1}]}));
  f.emails.length=0;
  f.c.fulfillOrder(normal.orderId,[{rowId:normal.orderId+'-01',qtyFulfilled:1}],10,'test',0);
  const pay=f.emails.pop();assert.match(pay.htmlBody,/It's ready/);assert.match(pay.htmlBody,/Final amount due at pickup/);assert.match(pay.htmlBody,/cash or check/);assert.doesNotMatch(pay.htmlBody,/Unfilled|carry forward/);
  f.c.fulfillOrder(r.orderId,[{rowId:r.orderId+'-01',qtyFulfilled:2},{rowId:r.orderId+'-02',qtyFulfilled:1}],10,'test',0);
  const hi=f.emails.pop();assert.match(hi.htmlBody,/Charged to H&amp;I budget/);assert.doesNotMatch(hi.htmlBody,/cash or check|amount due at pickup/i);
  // If building the styled version fails, the plain email still goes out.
  const g=hiFixture();g.c.Utilities.newBlob=()=>{throw new Error('no blob');};
  assert.equal(g.c.submitOrder(order({requestId:'req-style-3'})).success,true);
  const plain=g.emails.find(e=>e.to==='pat@example.invalid');assert.ok(plain.body.length>50);assert.equal(plain.htmlBody,undefined);assert.equal(plain.inlineImages,undefined);
});

test('marking an order Completed emails the group a receipt of what was actually picked up and paid',()=>{
  const f=fixture();
  f.ready(4);f.emails.length=0;                       // ordered 5, only 4 fulfilled at $10
  const done=f.c.completeOrder(f.oid,'test',1);assert.equal(done.success,true);assert.equal(done.warning,undefined);
  assert.equal(f.emails.length,1);const r=f.emails[0];
  assert.equal(r.to,'test@example.invalid');assert.match(r.subject,/Receipt/);assert.match(r.subject,/NL-2610-001/);
  assert.match(r.body,/Book \(x4\) - \$40\.00/);assert.doesNotMatch(r.body,/x5/);assert.match(r.body,/TOTAL PAID: \$40\.00/);assert.match(r.body,/PICKED UP: [A-Z][a-z]+ \d+, \d{4}/);
  assert.match(r.htmlBody,/Here's your receipt/);assert.match(r.htmlBody,/Total paid/);assert.match(r.htmlBody,/Paid in full/);assert.match(r.htmlBody,/Items received/);assert.match(r.htmlBody,/\$40\.00/);
  assert.doesNotMatch(r.htmlBody,/H&amp;I|Unfilled|Cash or check/);
  // Other transitions send no receipt; Undo Pickup sends nothing, completing again sends a fresh receipt.
  f.emails.length=0;assert.equal(f.c.uncompleteOrder(f.oid,'test',2).success,true);assert.equal(f.emails.length,0);
  assert.equal(f.c.completeOrder(f.oid,'test',3).success,true);assert.equal(f.emails.length,1);
});

test('receipt for an H&I order says charged to the budget, not paid',()=>{
  const f=hiFixture();
  const o=f.c.submitOrder(order({groupName:HI,requestId:'req-rcpt-hi',email:'hi@example.invalid',items:[{itemId:'B1',qty:2}]}));
  f.c.fulfillOrder(o.orderId,[{rowId:o.orderId+'-01',qtyFulfilled:2}],0,'test',0);f.emails.length=0;
  assert.equal(f.c.completeOrder(o.orderId,'test',1).success,true);
  const r=f.emails.pop();assert.equal(r.to,'hi@example.invalid');
  assert.match(r.body,/TOTAL CHARGED TO THE H&I SUBCOMMITTEE BUDGET: \$198\.00/);assert.doesNotMatch(r.body,/TOTAL PAID/);
  assert.match(r.htmlBody,/Charged to H&amp;I budget/);assert.doesNotMatch(r.htmlBody,/Paid in full|Total paid/);
});

test('no receipt for an order with nothing fulfilled; a failed receipt email still completes the order with a warning',()=>{
  const f=fixture();f.ready(0);f.emails.length=0;
  assert.equal(f.c.completeOrder(f.oid,'test',1).success,true);assert.equal(f.emails.length,0);
  const g=fixture();g.ready(3);g.failMail();
  const r=g.c.completeOrder(g.oid,'test',1);assert.equal(r.success,true);assert.ok(r.warning);assert.match(r.warning,/receipt/i);assert.equal(g.tables.Orders[1][9],'Completed');
});
