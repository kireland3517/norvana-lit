const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('assembled local preview loads Reports (Orders, Trends and Chair Report; inventory printing lives on the Inventory tab)',()=>{
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
  assert.doesNotMatch(elements['reports-content'].innerHTML,/>Inventory</);
  assert.equal((elements['reports-content'].innerHTML.match(/class="report-mode-tab/g)||[]).length,4);assert.match(elements['reports-content'].innerHTML,/>Trends</);
  assert.match(elements['report-panel'].innerHTML,/Example Group/);
  vm.runInContext("changeOrdersPeriod('annual');",c);flush();
  assert.match(elements['report-panel'].innerHTML,/Monthly breakdown/);
  vm.runInContext("setOrdersView('item');changeReportGroup('Second Group');",c);flush();
  assert.match(elements['report-panel'].innerHTML,/Fulfilled Value/);assert.match(elements['report-panel'].innerHTML,/20\.00/);
  assert.equal(vm.runInContext('ordersReportData.totals.collected',c),20);
  assert.equal(vm.runInContext('ordersReportData.totals.pending',c),0);
  vm.runInContext("changeOrdersPeriod('monthly');",c);flush();
  // Trends lives in the Reports tab; the Inventory tab's Trends button is a shortcut into it.
  vm.runInContext("setReportMode('trends');",c);flush();
  assert.match(elements['report-panel'].innerHTML,/id="trends-view"/);assert.doesNotMatch(elements['trends-view'].innerHTML,/Inventory/);
  assert.match(elements['trends-view'].innerHTML,/Quantities represent individual items, except readings, which are counted as sets\./);assert.match(elements['trends-view'].innerHTML,/include the H&amp;I Subcommittee/);
  vm.runInContext("setReportMode('orders');",c);flush();
  assert.match(elements['report-panel'].innerHTML,/individual items, except readings, which are counted as sets\. Orders and totals include the H&I Subcommittee, which is not a group\./);
  vm.runInContext("requestedReportMode=null;reportMode='orders';openTrendsShortcut();",c);flush();
  assert.equal(vm.runInContext('reportMode',c),'trends');assert.match(elements['report-panel'].innerHTML,/id="trends-view"/);
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

test('Reports move to the new ordering month after a meeting passes, but never during a save',()=>{
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
  assert.equal(vm.runInContext('reportMonth',c),'October 2026');
  vm.runInContext("responses.resumeSession=()=>({valid:true,token:'fixture',meetingMonth:'November 2026'});chairWritePending=true;switchView('reports');",c);flush();
  assert.equal(vm.runInContext('reportMonth',c),'October 2026');
  vm.runInContext("chairWritePending=false;switchView('reports');",c);flush();
  assert.equal(vm.runInContext('reportMonth',c),'November 2026');
  assert.equal(vm.runInContext('meetingMonth',c),'November 2026');
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
  const emails = [], appendLog = [], formats = [], hidden = new Set();
  function range(name,row,col,n=1,m=1) {
    return { getValues: () => Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>tables[name][row-1+i]?.[col-1+j] ?? '')),
      setValues(values) { values.forEach((r,i)=>r.forEach((v,j)=> {tables[name][row-1+i] ||= [];tables[name][row-1+i][col-1+j]=v;})); return this; },
      setValue(v) {return this.setValues([[v]]);}, setNumberFormat(f) { formats.push([name,row,col,n,m,f]); return this; },
      getDisplayValue() { return String(tables[name][row-1]?.[col-1] ?? ''); },
      clearContent() { for(let i=0;i<n;i++) for(let j=0;j<m;j++) if(tables[name][row-1+i]) tables[name][row-1+i][col-1+j]=''; return this; } };
  }
  const sheet = name => tables[name] ? { getSheetId:()=>names.indexOf(name), getDataRange:()=>({getValues:()=>tables[name].map(r=>r.slice())}), getRange:(...a)=>{if(typeof a[0]==='string'){const m=a[0].match(/^([A-Z]+)(\d+)$/);a=[Number(m[2]),[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)];}return range(name,...a);}, appendRow:r=>{appendLog.push({sheet:name,row:r.slice()});return tables[name].push(r);}, getLastRow:()=>tables[name].length, getMaxRows:()=>tables[name].length+50, hideRows:r=>hidden.add(r), showRows:r=>hidden.delete(r), clearContents:()=>tables[name]=[], deleteRow:r=>tables[name].splice(r-1,1), deleteRows:(r,n)=>tables[name].splice(r-1,n) } : null;
  function formatDate(d,tz,format) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
    if(format==='yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
    if(format==='yyyy-MM-dd HH:mm') return `${parts.year}-${parts.month}-${parts.day} ${new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}`;
    const month = new Intl.DateTimeFormat('en-US',{timeZone:tz,month:'long'}).format(d);
    if(format==='MMMM yyyy') return month+' '+parts.year;
    return month+' '+Number(parts.day)+', '+parts.year;
  }
  const context = vm.createContext({console,Date,Set,Map,JSON,Math,Number,Object,String,Array,RegExp,Error,
    SpreadsheetApp:{openById:()=>({getSheetByName:sheet,insertSheet:name=>{tables[name]=[];names.push(name);return sheet(name);}})}, Session:{getScriptTimeZone:()=> 'America/New_York'},
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
        else if(req.appendCells){const u=req.appendCells,n=names[u.sheetId];u.rows.forEach(r=>copy[n].push(r.values.map(c=>c.userEnteredValue.numberValue ?? c.userEnteredValue.stringValue)));}
        else {const r=req.deleteDimension.range;copy[names[r.sheetId]].splice(r.startIndex,r.endIndex-r.startIndex);}
      }
      Object.assign(tables,copy);
      if(loseResponse){loseResponse=false;throw Error('Response lost after commit');}
    }}}
  });
  for(const file of ['Code.gs','OrderWorkflow.gs','ChairReports.gs','EmailTemplate.gs','FreeStateOrders.gs','TrendsReport.gs','MonthlySummary.gs','ChairReportView.gs']) vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  const oid='NL-2610-001', quantities=q=>[{rowId:oid+'-01',qtyFulfilled:q}];
  return {c:context,tables,emails,appendLog,formats,hidden,oid,quantities,stock:()=>tables.Catalog[1][4],rev:()=>tables.Orders[1][11],
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

test('Trends count requested from every order, distributed from Completed only, and average only tracked months',()=>{
  const f=fixture(), plain=x=>JSON.parse(JSON.stringify(x));
  f.tables.Orders.push(['NL-2610-002','','October 2026','B','','','',20,10,'Completed','',0],['NL-2611-001','','Nov 2026','C','','','',100,100,'Completed','',0],
    ['NL-2611-002','','November 2026','D','','','',30,30,'Ready','',0],['NL-2612-001','','December 2026','E','','','',80,40,'Completed','',0],
    ['NL-2609-001','','September 2026','F','','','',990,990,'Completed','',0]);
  f.tables['Order Items'].push(['NL-2610-002-01','NL-2610-002','B1','Book',10,2,1,10],['NL-2611-001-01','NL-2611-001','B1','Book',10,10,10,100],
    ['NL-2611-002-01','NL-2611-002','B1','Book',10,3,3,30],['NL-2612-001-01','NL-2612-001','B1','Book',12,8,4,48],['NL-2609-001-01','NL-2609-001','B1','Book',10,99,99,990]);
  const dec=f.c.trendsReport_(f.c.getOrders('','test'),f.tables['Order Items'],f.c.getCatalogMap_(),'December 2026','December 2026');
  const row=dec.items[0];
  assert.deepEqual([row.requested,row.distributed,row.value,row.prev,row.avg],[8,4,48,10,5.5]);
  assert.deepEqual(plain([dec.avgMonths,dec.prevMonth,dec.monthToDate,dec.months]),[2,'November 2026',true,['October 2026','November 2026','December 2026']]);
  assert.deepEqual(plain(row.series),[1,10,4]);assert.deepEqual(plain(dec.series.map(m=>m.requested)),[7,13,8]);
  assert.deepEqual(plain(dec.availableMonths),['December 2026','November 2026','October 2026']);
  const oct=f.c.trendsReport_(f.c.getOrders('','test'),f.tables['Order Items'],f.c.getCatalogMap_(),'October 2026','December 2026').items[0];
  assert.deepEqual([oct.requested,oct.distributed,oct.prev,oct.avg],[7,1,null,null]);
  assert.throws(()=>f.c.trendsReport_(f.c.getOrders('','test'),f.tables['Order Items'],f.c.getCatalogMap_(),'September 2026','December 2026'),/start with October 2026/);
  assert.equal(f.c.getTrendsReport('November 2026','test').totals.distributed,10);
  assert.equal(f.c.getTrendsReport('November 2026','bad').success,false);
});

test('Monthly Summary is written from the Trends numbers, follows B1, and never blocks an order',()=>{
  const f=fixture();
  f.tables.Orders.push(['NL-2610-002','','October 2026','B','','','',20,10,'Completed','',0],['NL-2611-001','','Nov 2026','C','','','',100,100,'Completed','',0],['NL-2612-001','','December 2026','E','','','',80,40,'Completed','',0]);
  f.tables['Order Items'].push(['NL-2610-002-01','NL-2610-002','B1','Book',10,2,1,10],['NL-2611-001-01','NL-2611-001','B1','Book',10,10,10,100],['NL-2612-001-01','NL-2612-001','B1','Book',12,8,4,48]);
  assert.doesNotThrow(()=>f.c.refreshMonthlySummary_());assert.doesNotThrow(()=>f.c.refreshMonthlySummarySafe_());
  f.tables['Monthly Summary']=[['Month Filter','December 2026']];
  f.c.refreshMonthlySummary_();
  const t=f.tables['Monthly Summary'];
  assert.equal(t[1][1],'November 2026');assert.equal(t[1][0],'Compare with');assert.ok(f.formats.some(x=>x[2]===10&&x[5]==='@')&&f.formats.some(x=>x[2]===2&&x[3]===4&&x[5]==='@'));assert.equal(t[0][0],'Month Filter');assert.deepEqual(t.slice(1,4).map(r=>r[9]),['December 2026','November 2026','October 2026']);assert.equal(t[0][2],'Last updated');assert.deepEqual([...t[4].slice(0,8)],['All items','',8,4,48,10,5.5,2]);
  assert.deepEqual([...t[6].slice(0,8)],['Books','Book',8,4,48,10,5.5,2]);
  t[0][1]='October 2026';f.c.refreshMonthlySummary_();
  assert.equal(t[1][1],'n/a (before tracking began)');assert.deepEqual([...t[6].slice(0,8)],['Books','Book',7,1,10,'','',0]);
  t[0][1]='September 2026';f.c.refreshMonthlySummary_();
  assert.match(t[3][1],/start with October 2026/);assert.equal(t[6]?.[0]??'','');
  const sheetOf=name=>({getSheet:()=>({getName:()=>name}),getRow:()=>1,getColumn:()=>2});
  t[0][1]='December 2026';f.c.handleSummaryEdit({range:sheetOf('Orders')});assert.equal(t[1][1],'November 2026');
  assert.match(fs.readFileSync('MonthlySummary.gs','utf8'),/^[ -]*$/);
});

test('Monthly Summary formatting and setup run end to end (guarded to the editor)',()=>{
  const f=fixture(), calls=[], chain=new Proxy(function(){},{get:(_,k)=>k==='getValue'?()=>'':(...a)=>{calls.push(k);return chain;}});
  const sheet=new Proxy({},{get:(_,k)=>k==='getRange'?()=>chain:k==='getMaxRows'?()=>400:k==='getMaxColumns'?()=>30:(...a)=>{calls.push(k);return chain;}});
  Object.assign(f.c.SpreadsheetApp,{DataValidationCriteria:{VALUE_IN_RANGE:'r'},BorderStyle:{SOLID_MEDIUM:'m'},newDataValidation:()=>chain,newConditionalFormatRule:()=>chain});
  f.c.formatMonthlySummary_(sheet);
  assert.ok(calls.includes('setDataValidation')&&calls.includes('hideColumns')&&calls.includes('setFrozenRows')&&calls.includes('setConditionalFormatRules'));
  f.c.Session.getActiveUser=()=>({getEmail:()=>''});
  assert.throws(()=>f.c.requireEditor_(),/Apps Script editor/);
  f.c.Session.getActiveUser=()=>({getEmail:()=>'owner@example.invalid'});
  assert.doesNotThrow(()=>f.c.requireEditor_());
});

test('Chair Reports view shows only sent reports, hides drafts, and leaves the storage columns alone',()=>{
  const f=fixture(), plain=x=>JSON.parse(JSON.stringify(x));
  const sent={reportingMonth:'November 2026',ordersMonth:'October 2026',groupsServed:1,moneyCollected:18.25,hiCharged:0,moneySpent:5,other:'Notes here',version:2,sentAt:'2026-11-12T15:00:00.000Z',recipient:'secretary@example.invalid'};
  f.tables['Chair Reports'].push(['October 2026',JSON.stringify({reportingMonth:'October 2026',groupsServed:0}),'',1,''],
    ['November 2026',JSON.stringify({reportingMonth:'November 2026'}),JSON.stringify(sent),3,'{"status":"accepted"}']);
  const before=plain(f.tables['Chair Reports'].map(r=>r.slice(0,5)));
  f.c.refreshChairReportView_();
  const t=f.tables['Chair Reports'];
  assert.deepEqual(plain(t[0].slice(5,14)),['Orders recap','Groups served','Collected','H&I charged','Spent','Notes','Version','Sent on','Sent to']);
  assert.deepEqual(plain(t[1].slice(5,14)),['','','','','','','','','']);
  assert.deepEqual(plain(t[2].slice(5,12)),['October 2026',1,18.25,0,5,'Notes here',2]);
  assert.match(t[2][12],/^Nov(ember)? 12, 2026/);assert.equal(t[2][13],'secretary@example.invalid');
  assert.deepEqual(plain(t.map(r=>r.slice(0,5))),before);
  assert.deepEqual([...f.hidden],[2]);
  assert.doesNotThrow(()=>f.c.refreshChairReportViewSafe_());
});

test('Chair Reports setup runs end to end and only from the editor',()=>{
  const f=fixture(), calls=[], chain=new Proxy(function(){},{get:(_,k)=>(...a)=>{calls.push(k);return chain;}});
  f.c.getSheet=()=>new Proxy({},{get:(_,k)=>k==='getDataRange'?()=>({getValues:()=>[['Reporting Month'],['October 2026','{}','','','']]}):k==='getMaxRows'?()=>200:k==='getRange'?()=>chain:(...a)=>{calls.push(k);return chain;}});
  f.c.Session.getActiveUser=()=>({getEmail:()=>''});
  assert.throws(()=>f.c.setupChairReportView(),/Apps Script editor/);
  f.c.Session.getActiveUser=()=>({getEmail:()=>'owner@example.invalid'});
  assert.match(f.c.setupChairReportView(),/JSON columns/);
  assert.ok(calls.includes('hideColumns')&&calls.includes('hideRows'));
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
  ui.c.chairDirty=false;ui.c.setReportMode('orders');assert.equal(left,3);
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
test('pack size is saved on each new order line, and reports count individual items from that saved size (never from today\'s Catalog)', () => {
  const f = fixture(), NativeDate = Date;
  f.c.Date = class extends NativeDate {constructor(...args){super(...(args.length?args:['2026-10-02T03:59:59.999Z']));} static [Symbol.hasInstance](v){return v instanceof NativeDate;}};
  f.tables.Catalog[0][7] = 'Pack Size'; f.tables.Catalog[1][7] = 5;
  const sent = f.c.submitOrder({groupName: 'Group A', contactName: 'Test', email: 'group@example.invalid', items: [{itemId: 'B1', qty: 2}]});
  assert.equal(sent.success, true);
  const saved = f.tables['Order Items'].find(r => String(r[0]).startsWith(sent.orderId));
  assert.equal(saved[5], 2); assert.equal(saved[8], 5, 'Order Items column I holds the pack size');
  // Changing the Catalog afterwards must not change the saved line or any report built from it.
  f.tables.Catalog[1][7] = 10;
  const rep = f.c.getOrdersReport('monthly', 'October 2026', '', 'test');
  const item = rep.items.find(i => i.itemId === 'B1');
  assert.equal(item.requested, 15, 'new line: 2 packs of 5 = 10 items; legacy line (no saved size) counts 5 packs as 5');
  assert.deepEqual(JSON.parse(JSON.stringify(rep.unknownPackLines)).slice().sort(), ['NL-2610-001-01'], 'the old line has no saved pack size, so it counts as 1 and is flagged');
  // Values stay at the pack price: 2 x 99 for the new line plus 5 x 10 for the old one.
  assert.equal(item.estimated, 248);
});
test('Trends, Monthly Summary and the Orders By Item list order items by number: IP #6 before IP #11, 3 Years before 27 Years, 60 Days before 6 Months', () => {
  const f = fixture(), plain = x => JSON.parse(JSON.stringify(x));
  const items = [['B1','Books','Basic Text'],['B9','Books','Intro Guide'],['3111','IPs','IP #11 Sponsorship'],['3106','IPs','IP #6 Recovery and Relapse'],['3112','IPs','IP #12 Triangle'],
    ['4103','Keytags','90 Days'],['4104','Keytags','6 Months'],['4102','Keytags','60 Days'],['4100','Keytags','Welcome'],['4106','Keytags','1 Year'],['4108','Keytags','Multiple Years'],['4101','Keytags','30 Days'],
    ['4327','Medallions','27 Years'],['4303','Medallions','3 Years'],['4399','Medallions','Eternity'],['4301','Medallions','1 Year'],['4300','Medallions','18 Months'],['4330','Medallions','30 Years'],
    ['SP3111','Spanish Lit','IP #11 El Padrinazgo'],['SP3106','Spanish Lit','IP #6 Recuperacion']];
  f.tables.Catalog.length = 1;
  items.forEach(i => f.tables.Catalog.push([i[0], i[1], i[2], 1, 5, 'YES', 1, 1]));
  f.tables.Orders.push(['NL-2610-002','','October 2026','B','','','',1,1,'Completed','',0]);
  items.forEach((i, n) => f.tables['Order Items'].push(['NL-2610-002-' + String(n + 1).padStart(2, '0'), 'NL-2610-002', i[0], i[2], 1, 1, 1, 1, 1]));
  const names = (cat, list) => list.filter(r => r.category === cat).map(r => r.name);
  const rep = f.c.trendsReport_(f.c.getOrders('', 'test'), f.tables['Order Items'], f.c.getCatalogMap_(), 'October 2026', 'October 2026');
  assert.deepEqual(plain(names('IPs', rep.items)), ['IP #6 Recovery and Relapse', 'IP #11 Sponsorship', 'IP #12 Triangle']);
  assert.deepEqual(plain(names('Keytags', rep.items)), ['Welcome', '30 Days', '60 Days', '90 Days', '6 Months', '1 Year', 'Multiple Years']);
  assert.deepEqual(plain(names('Medallions', rep.items)), ['18 Months', '1 Year', '3 Years', '27 Years', '30 Years', 'Eternity']);
  assert.deepEqual(plain(names('Spanish Lit', rep.items)), ['IP #6 Recuperacion', 'IP #11 El Padrinazgo']);
  // The Monthly Summary rows come from the same list; the Orders report By Item list uses the same order within each category.
  assert.deepEqual(plain(f.c.monthlySummaryTable_(rep, 'now').rows.filter(r => r[0] === 'Medallions').map(r => r[1])), ['18 Months', '1 Year', '3 Years', '27 Years', '30 Years', 'Eternity']);
  const orders = f.c.getOrdersReport('monthly', 'October 2026', '', 'test');
  assert.deepEqual(plain(orders.items.filter(i => i.category === 'Keytags').map(i => i.name)), ['Welcome', '30 Days', '60 Days', '90 Days', '6 Months', '1 Year', 'Multiple Years']);
  assert.deepEqual(plain(orders.items.filter(i => i.category === 'IPs').map(i => i.name)), ['IP #6 Recovery and Relapse', 'IP #11 Sponsorship', 'IP #12 Triangle']);
});
test('Trends and Monthly Summary count individual items; fulfilled counts are multiplied separately; unknown lines are flagged', () => {
  const f = fixture(), plain = x => JSON.parse(JSON.stringify(x));
  f.tables.Orders.push(['NL-2610-002','','October 2026','B','','','',100,40,'Completed','',0]);
  f.tables['Order Items'][1][8] = 5;                       // the open order's line: 5 packs of 5
  f.tables['Order Items'].push(['NL-2610-002-01','NL-2610-002','B1','Book',10,10,4,40,5],   // 10 packs ordered, 4 filled, packs of 5
    ['NL-2610-002-02','NL-2610-002','B2','Reading Set',5,3,3,15,1]);                                // a set of 7 stays 1 set
  const rep = f.c.trendsReport_(f.c.getOrders('','test'), f.tables['Order Items'], f.c.getCatalogMap_(), 'October 2026', 'October 2026');
  const book = rep.items.find(i => i.itemId === 'B1'), sets = rep.items.find(i => i.itemId === 'B2');
  assert.deepEqual([book.requested, book.distributed, book.value], [75, 20, 40], '(5 + 10) x 5 requested, 4 x 5 distributed, value at pack price');
  assert.deepEqual([sets.requested, sets.distributed], [3, 3]);
  assert.deepEqual([rep.totals.requested, rep.totals.distributed], [78, 23]);
  assert.deepEqual(plain(rep.unknownPackLines), []);
  f.tables['Order Items'][1][8] = '';
  const flagged = f.c.trendsReport_(f.c.getOrders('','test'), f.tables['Order Items'], f.c.getCatalogMap_(), 'October 2026', 'October 2026');
  assert.deepEqual(plain(flagged.unknownPackLines), ['NL-2610-001-01']);
  const table = f.c.monthlySummaryTable_(flagged, 'now');
  assert.match(table.top[3][1], /Quantities represent individual items, except readings, which are counted as sets\./);
  assert.match(table.top[3][1], /Totals include the H&I Subcommittee/);
  assert.match(table.top[3][1], /WARNING: 1 order line/);
  assert.doesNotMatch(f.c.monthlySummaryTable_(rep, 'now').top[3][1], /WARNING/);
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
  assert.match(elements['inventory-content'].innerHTML,/Print \/ Export/);assert.match(elements['inventory-content'].innerHTML,/inv-field-label">Count</);assert.match(elements['inventory-content'].innerHTML,/inv-price-ro">\$10\.00/);assert.doesNotMatch(elements['inventory-content'].innerHTML,/inv-price-input|Save Stock/);assert.match(elements['inventory-content'].innerHTML,/aria-label="Edit price for Book"/);assert.match(elements['inventory-content'].innerHTML,/value="-2"/);
  vm.runInContext(`allOrders=[{orderId:'O',status:'Ready',estimatedTotal:50,groupName:'A'}];currentOrderId='O';renderOrderPanel({status:'Ready',revision:1,items:[{orderId:'O',rowId:'O-01',sheetRow:2,name:'Book',category:'Books',price:10,qtyOrdered:5,qtyFulfilled:3,stock:-2}]});`,c);
  assert.match(elements['panel-body'].innerHTML,/Available: -2/);assert.match(elements['panel-body'].innerHTML,/Reopen for editing/);
  vm.runInContext(`renderSettings({codeIsSet:true,email:'chair@example.invalid',secretaryEmail:'secretary@example.invalid',schedule:[]},[]);`,c);
  assert.match(elements['settings-content'].innerHTML,/Secretary Email/);
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
  assert.equal(live.moneyCollected,30);assert.equal(live.hiCharged,12);assert.equal(live.groupsServed,1,'the H&I Subcommittee is not a group, so it is not counted');
  f.tables.Orders.push(['NL-2610-004','','October 2026',HI,'','','',9,9,'Completed','',0],['NL-2610-005','','October 2026','group b','','','',5,5,'Completed','',0],['NL-2610-006','','October 2026','Group C','','','',5,5,'New','',0]);
  const more=f.c.getChairReport('November 2026','test').live;assert.equal(more.groupsServed,1,'the same group twice, or one with only an unfinished order, adds nothing');assert.equal(more.hiCharged,21,'H&I literature still counts toward its own total');assert.equal(more.moneyCollected,35);
  f.tables.Orders.length-=3;
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

// -- Inventory Target Stock + Print / Export --
const plain = x => JSON.parse(JSON.stringify(x));
function clientContext() {
  const elements = {};
  function element(id) { return elements[id] ||= { innerHTML: '', textContent: '', style: {}, classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} }, insertAdjacentHTML(where, s) { this.innerHTML += s; }, value: '' }; }
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const c = vm.createContext({ console, Date, Number, Set, Map, Math, JSON, Object, Array, String, setTimeout: () => 0, clearTimeout() {}, alert() {}, localStorage: storage, sessionStorage: storage,
    window: { addEventListener() {}, scrollTo() {} }, document: { body: element('body'), getElementById: element, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }, google: { script: { run: {} } } });
  for (const file of ['App.html', 'ReportUI.html']) for (const m of fs.readFileSync(file, 'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) vm.runInContext(m[1], c);
  return c;
}
const INV_ITEMS = [
  { itemId: '1101', category: 'Books', name: 'Basic Text', stock: 3, lowAt: 6, packSize: 1, targetStock: 20 },
  { itemId: '1130', category: 'Books', name: 'Sponsorship', stock: 12, lowAt: 6, packSize: 1, targetStock: 10 },
  { itemId: '3101', category: 'IPs', name: 'IP #1 Who, What, How, and Why', stock: 2, lowAt: 10, packSize: 5, targetStock: 40 },
  { itemId: '4100', category: 'Keytags', name: 'Welcome', stock: 0, lowAt: 5, packSize: 5, targetStock: null },
  { itemId: '4300', category: 'Medallions', name: '18 Months', stock: 50, lowAt: 5, packSize: 1, targetStock: null }
];

test('Target Stock is one above the Catalog Low At level (one whole pack above for pack items); no separate column is read', () => {
  const f = fixture();
  let item = f.c.getCatalogAll('test')[0];
  const step = i => (i.packSize > 1 ? i.packSize : 1);
  assert.equal(item.targetStock, item.lowAt + step(item)); assert.equal(item.stock, 2);
  f.tables.Catalog[1][6] = 12; f.tables.Catalog[1][8] = 99;
  item = f.c.getCatalogAll('test')[0];
  assert.equal(item.lowAt, 12); assert.equal(item.targetStock, 12 + step(item));
  f.tables.Catalog[1][6] = '';
  assert.equal(f.c.getCatalogAll('test')[0].targetStock, 5 + step(item));
  f.tables.Catalog[1][7] = 5; assert.equal(f.c.getCatalogAll('test')[0].targetStock, 10);
  // Bulk items: the optional Order Multiple (Catalog column J) replaces the pack size in the target.
  f.tables.Catalog[1][7] = 1; f.tables.Catalog[1][6] = 20; f.tables.Catalog[1][9] = 10;
  item = f.c.getCatalogAll('test')[0]; assert.equal(item.orderMultiple, 10); assert.equal(item.targetStock, 30); assert.equal(item.packSize, 1);
  f.tables.Catalog[1][9] = 'junk'; assert.equal(f.c.getCatalogAll('test')[0].orderMultiple, 1);
  f.tables.Catalog[1][9] = ''; f.tables.Catalog[1][7] = 5; assert.equal(f.c.getCatalogAll('test')[0].orderMultiple, 5);
  assert.equal(typeof f.c.updateTargetStocks, 'undefined');
});

test('inventory report: bulk items with an Order Multiple of 10 and Low At 20 suggest whole tens up to Low At + 10', () => {
  const c = clientContext();
  c.BULK = [0, 15, 20, 21].map((stock, n) => ({ itemId: 'H' + n, category: 'H&I', name: 'Booklet ' + n, stock, lowAt: 20, packSize: 1, orderMultiple: 10, targetStock: 30 }));
  const model = vm.runInContext("inventoryReportModel(BULK,{categories:null,include:'all'})", c);
  const rows = Object.fromEntries(model.groups.flatMap(g => g.rows).map(r => [r.itemId, r]));
  assert.equal(rows.H0.suggested, 30); assert.equal(rows.H0.packs, 3); assert.equal(rows.H0.status, 'Out of stock');
  assert.equal(rows.H1.suggested, 20); assert.equal(rows.H1.packs, 2); assert.equal(rows.H1.status, 'Low stock');
  assert.equal(rows.H2.suggested, 10); assert.equal(rows.H2.packs, 1); assert.equal(rows.H2.status, 'Low stock');
  assert.equal(rows.H3.suggested, 0); assert.equal(rows.H3.status, 'In stock');
});

test('inventory report: Suggested Order = max(0, Target - On Hand) in singles, blank targets say Set target and low/out ones are flagged', () => {
  const c = clientContext(); c.INV_ITEMS = INV_ITEMS;
  const model = vm.runInContext("inventoryReportModel(INV_ITEMS,{categories:null,include:'all'})", c);
  assert.deepEqual(plain(model.groups.map(g => g.category)), ['Books', 'IPs', 'Keytags', 'Medallions']);
  const rows = Object.fromEntries(model.groups.flatMap(g => g.rows).map(r => [r.itemId, r]));
  assert.equal(rows['1101'].suggested, 17); assert.equal(rows['1101'].status, 'Low stock');
  assert.equal(rows['1130'].suggested, 0); assert.equal(rows['1130'].status, 'In stock');
  assert.equal(rows['3101'].suggested, 40); assert.equal(rows['3101'].packs, 8);
  assert.equal(rows['4100'].suggested, null); assert.equal(rows['4100'].status, 'Out of stock'); assert.equal(rows['4100'].needsTarget, true);
  assert.equal(rows['4300'].needsTarget, false);
  assert.equal(model.needTarget, 1);
  const text = r => vm.runInContext('inventorySuggestedText', c)(r);
  assert.equal(text(rows['1101']), '17'); assert.equal(text(rows['3101']), '40 (8 packs of 5)'); assert.equal(text(rows['4100']), 'Set target'); assert.equal(text(rows['1130']), '0');
  // Items to reorder: suggested > 0, plus low/out items that have no target. In-stock items without a target are left out.
  const reorder = vm.runInContext("inventoryReportModel(INV_ITEMS,{categories:null,include:'reorder'})", c);
  assert.deepEqual(plain(reorder.groups.flatMap(g => g.rows).map(r => r.itemId)), ['1101', '3101', '4100']);
  // Only the chosen categories are included, in one grouped report.
  const books = vm.runInContext("inventoryReportModel(INV_ITEMS,{categories:['Books','Keytags'],include:'all'})", c);
  assert.deepEqual(plain(books.groups.map(g => g.category)), ['Books', 'Keytags']);
  assert.equal(vm.runInContext("inventoryScopeText(inventoryReportModel(INV_ITEMS,{categories:['Books','Keytags'],include:'reorder'}),{categories:['Books','Keytags'],include:'reorder'})", c), 'Categories: Books, Keytags | Items: Items to reorder');
  assert.equal(vm.runInContext("inventoryScopeText(inventoryReportModel(INV_ITEMS,{categories:null,include:'all'}),{categories:null,include:'all'})", c), 'Categories: All categories | Items: All items');
});

test('inventory Print and CSV outputs: required columns and header, written status words, no prices or active flag', () => {
  const c = clientContext(); c.INV_ITEMS = INV_ITEMS;
  const captured = {};
  c.printReportPage = (title, html) => { captured.print = { title, html }; };
  c.downloadReportCSV = (title, rows) => { captured.csv = { title, rows }; };
  vm.runInContext("createInventoryReport(INV_ITEMS,{categories:null,include:'reorder'},'print')", c);
  const html = captured.print.html;
  assert.match(html, /NORVANA Literature Inventory/); assert.match(html, /Generated: /); assert.match(html, /Categories: All categories \| Items: Items to reorder/);
  for (const h of ['Item #', 'Item Name', 'On Hand', 'Target Stock', 'Suggested Order', 'Stock Status']) assert.match(html, new RegExp('<th[^>]*>' + h + '</th>'));
  assert.match(html, /LOW STOCK/); assert.match(html, /OUT OF STOCK/); assert.match(html, /Set target/); assert.match(html, /40 \(8 packs of 5\)/); assert.match(html, /Pack of 5 - counts are in singles/);
  assert.doesNotMatch(html, /Sponsorship/); assert.doesNotMatch(html, /\$|Price|Active/);
  vm.runInContext("createInventoryReport(INV_ITEMS,{categories:['Books'],include:'all'},'csv')", c);
  const rows = captured.csv.rows; assert.match(captured.csv.title, /^NORVANA Literature Inventory \d{4}-\d{2}-\d{2}$/);
  assert.equal(rows[0][0], 'NORVANA Literature Inventory'); assert.equal(rows[1][0], 'Generated'); assert.match(rows[2][1], /Categories: Books \| Items: All items/);
  const head = rows.findIndex(r => r[0] === 'Category'); assert.deepEqual(plain(rows[head].slice(0, 7)), ['Category', 'Item #', 'Item Name', 'On Hand', 'Target Stock', 'Suggested Order', 'Stock Status']);
  assert.deepEqual(plain(rows.slice(head + 1).map(r => r[1])), ['1101', '1130']); assert.equal(rows[head + 1][5], 17);
});

test('Inventory tab: Print / Export replaces View Inventory Report, Reports tab loses its Inventory option, no Target field in the app, thresholds untouched', () => {
  const app = fs.readFileSync('App.html', 'utf8'), ui = fs.readFileSync('ReportUI.html', 'utf8');
  assert.match(app, /openInventoryExport\(\)">Print \/ Export<\/button>/); assert.doesNotMatch(app, /View Inventory Report/);
  assert.doesNotMatch(ui, /\['inventory','Inventory'\]/); assert.doesNotMatch(ui, /openInventoryReport|getStockReport/);
  assert.doesNotMatch(app, /invtarget-|inv-target/); assert.match(app, /data-low-at=/);
  assert.match(app, /name="inv-export-include" value="all" checked/); assert.match(app, /id="inv-export-all" checked/);
});

// -- Free State orders --
const FS_VALUES = {email:'freestate@example.invalid',billLocation:'Church Hall',billAddress:'1 Main St',billCity:'Arlington',billState:'VA',billZip:'22204',billContact:'Jane D.',billPhone:'703-555-0100',shipName:'Jane D.',shipPhone:'703-555-0100',shipStreet:'2 Side St',shipCity:'Arlington',shipState:'VA',shipZip:'22204'};
function fsFixture(skipSettings) {
  const f = fixture();
  f.tables.Catalog.push(['P1','IPs','IP #1 <Who>',1,3,'YES',5,10],['S1','Spanish Lit','Spanish Basic Text',9,0,'YES'],['H1','H&I','H&I Booklet',1,0,'YES'],['H2','H&I','H&I Stocked Booklet',1,0,'YES',5,1,'Stocked']);
  if (!skipSettings) assert.equal(f.c.saveFreeStateSettings(FS_VALUES,'test').success,true);
  f.preview = lines => f.c.previewFreeStateOrder(lines || [{itemId:'B1',qty:20},{itemId:'P1',qty:40,requestedFor:''},{itemId:'S1',qty:3,requestedFor:'Spanish group'}],'test');
  f.log = () => f.tables['Free State Order Log'];
  f.history = () => f.tables['Order History'];
  return f;
}
test('Free State settings: missing fields are named, saved to Config once, and validated; Bill To email is the Lit Chair email',()=>{
  const f = fsFixture(true), s = f.c.getFreeStateSettings('test');
  assert.equal(s.success,true);assert.equal(s.groupName,'Northern Virginia Area of NA');assert.equal(s.litChairEmail,'chair@example.invalid');assert.equal(s.missing.length,14);
  assert.equal(f.c.saveFreeStateSettings({...FS_VALUES,email:'nope'},'test').success,false);
  assert.equal(f.c.saveFreeStateSettings(FS_VALUES,'test').success,true);assert.equal(f.c.getFreeStateSettings('test').missing.length,0);
  const rows = f.tables.Config.length;f.c.saveFreeStateSettings({...FS_VALUES,billCity:'Fairfax'},'test');
  assert.equal(f.tables.Config.length,rows);assert.equal(f.c.getFreeStateSettings('test').values.billCity,'Fairfax');
  assert.equal(f.c.saveFreeStateSettings(FS_VALUES,'bad-token').success,false);assert.equal(f.c.getFreeStateSettings('bad-token').success,false);
  assert.equal(f.c.getFreeStateSettings('test').values.billCity,'Fairfax');
  f.c.saveFreeStateSettings({...FS_VALUES,billPhone:''},'test');assert.equal(f.c.getFreeStateSettings('test').missing.length,1);
});
test('Free State preview: validates every line on the server and never exposes stock, requested-for notes or types',()=>{
  const f = fsFixture(), bad = lines => f.preview(lines);
  assert.equal(bad([]).success,false);assert.equal(bad([{itemId:'B1',qty:0},{itemId:'P1',qty:''}]).success,false);
  assert.equal(bad([{itemId:'B1',qty:-1}]).success,false);assert.equal(bad([{itemId:'B1',qty:1.5}]).success,false);assert.equal(bad([{itemId:'B1',qty:'abc'}]).success,false);
  assert.equal(bad([{itemId:'B1',qty:1},{itemId:'B1',qty:2}]).success,false);assert.equal(bad([{itemId:'NOPE',qty:1}]).success,false);assert.equal(bad([{itemId:'B2',qty:1}]).success,false);
  const g = fsFixture(true);assert.match(g.preview().error,/Fill in these Free State settings/);assert.equal(g.preview().missing.length,14);
  assert.equal(f.c.previewFreeStateOrder([{itemId:'B1',qty:1}],'bad-token').success,false);
  const p = f.preview();assert.equal(p.success,true);assert.equal(p.to,'freestate@example.invalid');assert.equal(p.from,'norvanalit12@gmail.com');assert.equal(p.subject,'NORVANA Literature Order');
  assert.deepEqual(JSON.parse(JSON.stringify(p.lines)),[{itemId:'B1',name:'Book',qty:20},{itemId:'P1',name:'IP #1 <Who>',qty:40},{itemId:'S1',name:'Spanish Basic Text',qty:3}]);
  assert.match(p.html,/Bill To[\s\S]*Ship To[\s\S]*Order Items/);assert.match(p.html,/IP #1 &lt;Who&gt;/);assert.match(p.html,/Northern Virginia Area of NA/);assert.match(p.html,/chair@example\.invalid/);
  assert.match(p.text,/BILL TO\nGroup Name: Northern Virginia Area of NA/);assert.match(p.text,/P1 \| IP #1 <Who> \| 40/);
  assert.doesNotMatch(p.html+p.text+JSON.stringify(p.lines),/Spanish group|Stocked|Order on Request|On Hand|Low At|stock/i);
});
test('Free State send: logs the pending record before emailing, emails once, records history, never touches stock',()=>{
  const f = fsFixture(), p = f.preview(), stockBefore = JSON.stringify(f.tables.Catalog.map(r=>r[4]));let claimSeen = null;
  f.mailHook(()=>claimSeen = f.log().slice(1).map(r=>r[2]));
  assert.equal(f.c.sendFreeStateOrder(p.previewId,'bad-token').success,false);assert.equal(f.emails.length,0);
  const r = f.c.sendFreeStateOrder(p.previewId,'test');
  assert.equal(r.success,true);assert.deepEqual(claimSeen,['Sending']);assert.equal(f.emails.length,1);
  assert.equal(f.emails[0].to,'freestate@example.invalid');assert.equal(f.emails[0].subject,'NORVANA Literature Order');assert.match(f.emails[0].htmlBody,/Order Items/);assert.match(f.emails[0].body,/ORDER ITEMS/);
  assert.match(r.order.orderId,/^FS-\d{4}-001$/);assert.equal(r.order.lines.length,3);assert.doesNotMatch(JSON.stringify(r.order),/Spanish group|Order on Request/);
  assert.equal(f.log()[1][2],'Recorded');
  const h = f.history().slice(1);assert.equal(h.length,3);assert.deepEqual(h.map(x=>[x[2],x[3],x[4],x[5],x[6],x[7],x[8]]),[['B1','Book',20,'Stocked','','Sent','freestate@example.invalid'],['P1','IP #1 <Who>',40,'Stocked','','Sent','freestate@example.invalid'],['S1','Spanish Basic Text',3,'Stocked','Spanish group','Sent','freestate@example.invalid']]);
  assert.match(h[0][9],/Group Location: Church Hall/);assert.match(h[0][10],/Street Address: 2 Side St/);
  assert.equal(JSON.stringify(f.tables.Catalog.map(r=>r[4])),stockBefore);
  const again = f.c.sendFreeStateOrder(p.previewId,'test');assert.equal(again.success,true);assert.equal(again.alreadySent,true);assert.equal(f.emails.length,1);assert.equal(f.history().length,4);
  const q = f.preview([{itemId:'B1',qty:5}]);assert.match(f.c.sendFreeStateOrder(q.previewId,'test').order.orderId,/-002$/);assert.equal(f.emails.length,2);
});
test('Free State send: concurrent requests, a lost claim write, expired and changed previews send nothing',()=>{
  const f = fsFixture(), p = f.preview();let inner;
  f.hook(()=>inner = f.c.sendFreeStateOrder(p.previewId,'test'));f.c.sendFreeStateOrder(p.previewId,'test');
  assert.equal(inner.success,false);assert.equal(f.emails.length,1);
  const g = fsFixture(), q = g.preview();g.failBatch(true);const r = g.c.sendFreeStateOrder(q.previewId,'test');
  assert.equal(r.success,false);assert.match(r.error,/nothing was emailed/);assert.equal(g.emails.length,0);assert.equal(g.mailCalls(),0);
  const h = fsFixture(), s = h.preview();h.c.CacheService.getScriptCache().remove('fs_preview_'+s.previewId);
  const e = h.c.sendFreeStateOrder(s.previewId,'test');assert.equal(e.expired,true);assert.equal(h.emails.length,0);
  const t = h.preview(), fp = t.fingerprint;h.c.saveFreeStateSettings({...FS_VALUES,email:'other@example.invalid'},'test');
  const c = h.c.sendFreeStateOrder(t.previewId,'test');assert.equal(c.changed,true);assert.equal(h.emails.length,0);
  const u = h.preview();assert.notEqual(u.fingerprint,fp);assert.equal(h.c.sendFreeStateOrder(u.previewId,'test').success,true);assert.equal(h.emails[0].to,'other@example.invalid');
  const w = fsFixture(), x = w.preview();w.quota(0);const nq = w.c.sendFreeStateOrder(x.previewId,'test');assert.equal(nq.success,false);assert.equal(w.mailCalls(),0);assert.equal(w.log().length,1);
});
test('Free State send: a failed or uncertain email is never resent automatically; recovery is explicit',()=>{
  const f = fsFixture(), p = f.preview();f.failMail(true);
  const u = f.c.sendFreeStateOrder(p.previewId,'test');
  assert.equal(u.success,false);assert.equal(u.state,'uncertain');assert.match(u.error,/Sent folder/);assert.equal((f.history()||[]).length,0);
  assert.equal(f.log()[1][2],'Uncertain');assert.equal(f.mailCalls(),1);
  assert.equal(f.c.sendFreeStateOrder(p.previewId,'test').state,'uncertain');assert.equal(f.mailCalls(),1);
  const blocked = f.c.sendFreeStateOrder(f.preview([{itemId:'B1',qty:1}]).previewId,'test');assert.equal(blocked.blocked,true);assert.equal(f.mailCalls(),1);
  assert.equal(f.c.getFreeStateOrderState('test').pending.state,'uncertain');
  const rid = f.log()[1][0];assert.equal(f.c.resolveFreeStateOrder(rid,'bogus','test').success,false);assert.equal(f.c.resolveFreeStateOrder(rid,'retry','bad-token').success,false);
  f.failMail(false);const done = f.c.resolveFreeStateOrder(rid,'retry','test');
  assert.equal(done.success,true);assert.equal(f.emails.length,1);assert.equal(f.history().length,4);assert.equal(f.c.getFreeStateOrderState('test').pending,null);
  assert.equal(f.c.resolveFreeStateOrder(rid,'retry','test').alreadySent,true);assert.equal(f.emails.length,1);
});
test('Free State recovery: record-only after an uncertain send, and history retries are safe after a failed history write',()=>{
  const f = fsFixture(), p = f.preview();f.acceptThenThrow(true);
  const u = f.c.sendFreeStateOrder(p.previewId,'test');assert.equal(u.state,'uncertain');assert.equal(f.emails.length,1);assert.equal((f.history()||[]).length,0);
  const rid = f.log()[1][0];f.acceptThenThrow(false);
  const r = f.c.resolveFreeStateOrder(rid,'record','test');assert.equal(r.success,true);assert.equal(f.emails.length,1);assert.equal(f.history().length,4);assert.equal(f.log()[1][2],'Recorded');
  assert.equal(f.c.resolveFreeStateOrder(rid,'record','test').alreadySent,true);assert.equal(f.history().length,4);
  const g = fsFixture(), q = g.preview(), realBatch = g.c.Sheets.Spreadsheets.batchUpdate;let failHistory = true;
  g.c.Sheets.Spreadsheets.batchUpdate = (a,id)=>{if(failHistory&&a.requests.some(r=>r.appendCells&&r.appendCells.rows[0].values.length===12))throw Error('History write failed');return realBatch(a,id);};
  const a = g.c.sendFreeStateOrder(q.previewId,'test');
  assert.equal(a.success,false);assert.equal(a.state,'accepted');assert.match(a.error,/Do not send it again/);assert.equal(g.emails.length,1);assert.ok((g.history()||[]).length<=1);
  failHistory = false;assert.equal(g.c.getFreeStateOrderState('test').pending.state,'accepted');
  const blocked = g.c.sendFreeStateOrder(g.preview([{itemId:'B1',qty:1}]).previewId,'test');assert.equal(blocked.blocked,true);
  const rid2 = g.c.getFreeStateOrderState('test').pending.requestId;
  assert.equal(g.c.resolveFreeStateOrder(rid2,'retry','test').success,false);assert.equal(g.emails.length,1);
  assert.equal(g.c.resolveFreeStateOrder(rid2,'record','test').success,true);assert.equal(g.history().length,4);assert.equal(g.emails.length,1);
});
test('Free State: an unfinished order creates no history rows',()=>{
  const f = fsFixture();f.preview();f.preview([{itemId:'B1',qty:2}]);
  assert.equal(f.history(),undefined);assert.equal(f.log(),undefined);
});
test('Inventory Type: every product is Stocked by default, H&I and Spanish included; the Catalog sheet (column I) can switch one product to Order on Request',()=>{
  const f = fsFixture(), type = id => f.c.getCatalogAll('test').find(i=>i.itemId===id).inventoryType;
  const items = Object.fromEntries(f.c.getCatalogAll('test').map(i=>[i.itemId,i.inventoryType]));
  assert.deepEqual(items,{B1:'Stocked',B2:'Stocked',P1:'Stocked',S1:'Stocked',H1:'Stocked',H2:'Stocked'});
  f.tables.Catalog[4][8] = ' order on request ';assert.equal(type('S1'),'Order on Request');
  f.tables.Catalog[4][8] = 'Stocked';assert.equal(type('S1'),'Stocked');
  f.tables.Catalog[1][8] = 'Order on Request';assert.equal(type('B1'),'Order on Request');
  f.tables.Catalog[1][8] = 'garbage';assert.equal(type('B1'),'Stocked');
  assert.equal(f.c.updateInventoryType,undefined);
  assert.equal(f.c.getCatalogForForm().every(i=>!('inventoryType' in i)),true);
});

test('inventory report: Order on Request items are separate, never low or out, never in Items to reorder',()=>{
  const c=vm.createContext({console,Math,Number,String,Array,Set,JSON,Object,CAT_ORDER:['Books','Spanish Lit','H&I']});
  const html=fs.readFileSync('ReportUI.html','utf8');
  vm.runInContext("function esc(s){return String(s);}",c);
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],c);
  vm.runInContext("var ITEMS=[{itemId:'B1',category:'Books',name:'Basic Text',stock:0,lowAt:5,targetStock:5,packSize:1,inventoryType:'Stocked'},{itemId:'S1',category:'Spanish Lit',name:'Spanish Text',stock:0,lowAt:5,targetStock:5,packSize:5,inventoryType:'Order on Request'},{itemId:'B2',category:'Books',name:'Request Book',stock:0,lowAt:5,targetStock:5,packSize:1,inventoryType:'Order on Request'}];",c);
  const all=vm.runInContext("inventoryReportModel(ITEMS,{categories:null,include:'all'})",c);
  const books=all.groups.find(g=>g.category==='Books').rows;
  assert.deepEqual(JSON.parse(JSON.stringify(books.map(r=>r.itemId))),['B1','B2']);assert.equal(books[0].status,'Out of stock');assert.equal(books[1].status,'On request');
  assert.equal(books[1].onHand,null);assert.equal(books[1].suggested,null);assert.equal(all.onRequestCount,2);
  const reorder=vm.runInContext("inventoryReportModel(ITEMS,{categories:null,include:'reorder'})",c);
  assert.deepEqual(JSON.parse(JSON.stringify(reorder.groups.flatMap(g=>g.rows.map(r=>r.itemId)))),['B1']);
  const page=vm.runInContext("inventoryPrintHTML(inventoryReportModel(ITEMS,{categories:null,include:'all'}),{generated:'now',scope:'all'})",c);
  assert.match(page,/On request/);assert.match(page,/ordered only when someone asks/);assert.match(page,/Spanish Text[\s\S]*?<td>-<\/td><td>-<\/td><td>-<\/td><td>On request<\/td>/);assert.equal((page.match(/OUT OF STOCK/g)||[]).length,1);
  const csv=vm.runInContext("inventoryCSVRows(inventoryReportModel(ITEMS,{categories:null,include:'all'}),{generated:'now',scope:'all'})",c);
  const header=csv.find(r=>r[0]==='Category');assert.equal(header[header.length-1],'Inventory Type');
  assert.deepEqual(JSON.parse(JSON.stringify(csv.find(r=>r[1]==='S1').slice(3))),['','','','On request','Pack of 5 (counts are singles)','','Order on Request']);
});

test('Free State screens: suggestions, quantity limits, picker, draft kept across screens, review and send',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[], store=new Map();
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},value:'',classList:{add(){},remove(){},contains(){return false;},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},getAttribute(){return null;},querySelector:()=>null,insertAdjacentHTML(where,s){this.innerHTML+=s;}};}
  const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),get length(){return store.size;},key:i=>Array.from(store.keys())[i]};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,
    setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  function flush(){let n=0;while(timers.length){assert.ok(n++<30,'callbacks must settle');timers.shift()();}}
  vm.runInContext("sessionToken='fixture';dashboardSignedOut=false;renderInventory(demoCatalog);openFreeStateOrder();",c);flush();
  assert.match(elements['inventory-content'].innerHTML,/Create Free State Order/);
  assert.equal(elements['inventory-content'].style.display,'none');
  assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(fs.lines.map(l=>[l.itemId,l.qty]))",c)),[['B1','7']]);
  const screen=elements['fs-order'].innerHTML;
  assert.match(screen,/Free State Order/);assert.match(screen,/Item #<\/th><th>Description<\/th><th class="fs-q">Quantity/);assert.doesNotMatch(screen,/On Hand|Target|Total |In stock|Low stock/i);
  assert.match(screen,/Add Item/);assert.match(screen,/Review &amp; Send/);assert.doesNotMatch(screen,/Spanish|SP3101/);
  // Quantity box only keeps digits; blank or zero is left out of the order.
  const input={value:'-4.5x'};vm.runInContext("fsSetQty('B1',INPUT)",Object.assign(c,{INPUT:input}));
  assert.equal(input.value,'45');assert.equal(vm.runInContext("fsLine('B1').qty",c),'45');
  // Picker lists every active product by category, greys out what is already ordered, and adds each product once.
  vm.runInContext("fsTogglePicker()",c);
  const picker=elements['fs-order'].innerHTML;assert.match(picker,/Spanish/);assert.match(picker,/SP3101/);assert.match(picker,/Basic Text \(added\)/);
  vm.runInContext("fsAdd('SP3101');fsAdd('SP3101');",c);
  assert.equal(vm.runInContext("fs.lines.filter(l=>l.itemId==='SP3101').length",c),1);
  assert.match(elements['fs-order'].innerHTML,/Requested for \(optional, not sent to Free State\)/);
  vm.runInContext("fsSetRequested('SP3101','Spanish group')",c);
  // Edits survive a refresh of the order screens and leaving for Settings (draft kept in this tab only).
  assert.match(store.get('norvana_fs_draft'),/Spanish group/);
  vm.runInContext("fsReset()",c);assert.equal(elements['inventory-content'].style.display,'');
  vm.runInContext("openFreeStateOrder()",c);flush();
  assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(fs.lines.map(l=>[l.itemId,l.qty,l.requestedFor]))",c)),[['B1','45',''],['SP3101','','Spanish group']]);
  // Review needs a quantity, then shows the email; Back to Edit keeps every change.
  vm.runInContext("fsLine('B1').qty='';fsReview()",c);flush();assert.equal(vm.runInContext("fs.screen",c),'edit');assert.match(elements['fs-msg'].textContent,/Enter a quantity for at least one product/);vm.runInContext("fsLine('B1').qty='45'",c);
  vm.runInContext("fsLine('SP3101').qty='12';fsReview()",c);flush();
  assert.equal(vm.runInContext("fs.screen",c),'review');assert.match(elements['fs-order'].innerHTML,/From:<\/strong> norvanalit12@gmail.com/);assert.match(elements['fs-order'].innerHTML,/To:<\/strong> freestate@example.invalid/);assert.match(elements['fs-order'].innerHTML,/srcdoc=/);
  vm.runInContext("fsBackToEdit()",c);assert.equal(vm.runInContext("fs.screen",c),'edit');assert.equal(vm.runInContext("fsLine('SP3101').qty",c),'12');
  // Sending shows the confirmation only after the server says it worked, then clears the draft.
  vm.runInContext("fsReview()",c);flush();vm.runInContext("fsSend()",c);
  assert.equal(vm.runInContext("fs.busy",c),true);vm.runInContext("fsSend()",c);flush();
  assert.equal(vm.runInContext("fs.screen",c),'sent');assert.match(elements['fs-order'].innerHTML,/Order Sent/);assert.match(elements['fs-order'].innerHTML,/sent successfully and recorded in Google Sheets/);assert.match(elements['fs-order'].innerHTML,/Print Order[\s\S]*Done/);
  assert.equal(store.has('norvana_fs_draft'),false);
  vm.runInContext("fsExit()",c);assert.equal(elements['fs-order'].innerHTML,'');
  // Sign-out clears the saved order.
  vm.runInContext("fs.lines=[{itemId:'B1',qty:'3'}];fsSaveDraft();clearAllFulfillDraftsFromStorage();",c);assert.equal(store.has('norvana_fs_draft'),false);
});

test('Free State order: an empty saved draft is ignored, and Reset to Suggested rebuilds the list from the current counts',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[], store=new Map();
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},value:'',classList:{add(){},remove(){},contains(){return false;},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},getAttribute(){return null;},querySelector:()=>null,insertAdjacentHTML(where,s){this.innerHTML+=s;}};}
  const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),get length(){return store.size;},key:i=>Array.from(store.keys())[i]};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,
    setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  function flush(){let n=0;while(timers.length){assert.ok(n++<30,'callbacks must settle');timers.shift()();}}
  vm.runInContext("sessionToken='fixture';dashboardSignedOut=false;renderInventory(demoCatalog);",c);
  const lines=()=>JSON.parse(vm.runInContext("JSON.stringify(fs.lines.map(l=>[l.itemId,l.qty]))",c));
  // A blank order saved earlier in this tab must not hide products that are low now.
  store.set('norvana_fs_draft',JSON.stringify({lines:[]}));
  vm.runInContext("openFreeStateOrder()",c);flush();
  assert.deepEqual(lines(),[['B1','7']]);
  assert.match(elements['fs-order'].innerHTML,/Reset to Suggested/);
  // A real unfinished order is still kept.
  vm.runInContext("fsLine('B1').qty='2';fsAdd('SP3101');fsReset();openFreeStateOrder();",c);flush();
  assert.deepEqual(lines(),[['B1','2'],['SP3101','']]);
  // Reset asks first; saying yes puts the suggestions back and saves them; saying no changes nothing.
  vm.runInContext("fsResetToSuggested();closeConfirm(false);",c);assert.deepEqual(lines(),[['B1','2'],['SP3101','']]);
  vm.runInContext("fsResetToSuggested();closeConfirm(true);",c);
  assert.deepEqual(lines(),[['B1','7']]);assert.match(store.get('norvana_fs_draft'),/"qty":"7"/);
  assert.match(elements['fs-order'].innerHTML,/Order reset to the suggested items/);
  // Nothing low: an empty list with an explanation instead of a silent blank.
  vm.runInContext("fsSuggestedLines=function(){return [];};fsResetToSuggested();closeConfirm(true);",c);
  assert.deepEqual(lines(),[]);assert.match(elements['fs-order'].innerHTML,/No stocked product is low or out of stock right now/);
});
test('Free State order: every low (yellow) or out (red) stocked product is listed, brought to one above Low At (one pack above for 5-packs)',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[], store=new Map();
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},value:'',classList:{add(){},remove(){},contains(){return false;},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},getAttribute(){return null;},querySelector:()=>null,insertAdjacentHTML(where,s){this.innerHTML+=s;}};}
  const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),get length(){return store.size;},key:i=>Array.from(store.keys())[i]};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,
    setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  function flush(){let n=0;while(timers.length){assert.ok(n++<30,'callbacks must settle');timers.shift()();}}
  const cat=[
    {itemId:'A1',name:'Below',category:'Books',price:1,stock:4,lowAt:6,targetStock:7,packSize:1,inventoryType:'Stocked',active:true},
    {itemId:'A2',name:'Out',category:'Books',price:1,stock:0,lowAt:3,targetStock:4,packSize:1,inventoryType:'Stocked',active:true},
    {itemId:'A3',name:'At Low At pack',category:'IPs',price:1,stock:15,lowAt:15,targetStock:20,packSize:5,inventoryType:'Stocked',active:true},
    {itemId:'A4',name:'Fine',category:'IPs',price:1,stock:17,lowAt:15,targetStock:20,packSize:5,inventoryType:'Stocked',active:true},
    {itemId:'A5',name:'Inactive low',category:'IPs',price:1,stock:0,lowAt:3,targetStock:8,packSize:5,inventoryType:'Stocked',active:false},
    {itemId:'A6',name:'Pack not a multiple',category:'Keytags',price:1,stock:12,lowAt:15,targetStock:20,packSize:5,inventoryType:'Stocked',active:true},
    {itemId:'A7',name:'At Low At single',category:'Books',price:1,stock:1,lowAt:1,targetStock:2,packSize:1,inventoryType:'Stocked',active:true},
    {itemId:'SP1',name:'H&I or Spanish now counted',category:'Spanish Lit',price:1,stock:0,lowAt:5,targetStock:10,packSize:5,inventoryType:'Stocked',active:true},
    {itemId:'OR1',name:'Switched to on request',category:'Books',price:1,stock:0,lowAt:5,targetStock:6,packSize:1,inventoryType:'Order on Request',active:true}];
  c.CAT=cat;
  vm.runInContext("sessionToken='fixture';dashboardSignedOut=false;renderInventory(CAT);openFreeStateOrder();",c);flush();
  const lines=()=>JSON.parse(vm.runInContext("JSON.stringify(fs.lines.map(l=>[l.itemId,l.qty]))",c));
  assert.deepEqual(lines().sort((x,y)=>x[0].localeCompare(y[0])),[['A1','3'],['A2','4'],['A3','5'],['A6','10'],['A7','1'],['SP1','10']]);
});

test('Free State recovery: a send that died leaving a Sending record is uncertain once the lock is held, never auto-resent',()=>{
  const f = fsFixture(), p = f.preview();f.acceptThenThrow(true);f.mailHook(()=>f.failBatch(true));
  const r = f.c.sendFreeStateOrder(p.previewId,'test');assert.equal(r.state,'uncertain');assert.equal(f.log()[1][2],'Sending');assert.equal(f.emails.length,1);
  f.failBatch(false);f.mailHook(null);f.acceptThenThrow(false);
  assert.equal(f.c.getFreeStateOrderState('test').pending.state,'sending');
  assert.equal(f.c.sendFreeStateOrder(p.previewId,'test').state,'uncertain');assert.equal(f.emails.length,1);
  const rid = f.log()[1][0];assert.equal(f.c.resolveFreeStateOrder(rid,'record','test').success,true);assert.equal(f.emails.length,1);assert.equal(f.history().length,4);
});

test('Free State missing-settings notice lists each field on its own line under Order email, Bill To and Ship To',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[];
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},contains(){return false;}},insertAdjacentHTML(){}};}
  const storage={getItem:()=>null,setItem(){},removeItem(){}};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  const out=vm.runInContext("fs.missing=['Free State Order Email','Bill To: Group Location','Bill To: City','Ship To: Name'];fsNoticeHTML()",c);
  assert.match(out,/Bill To<\/div><ul[^>]*><li>Group Location<\/li><li>City<\/li><\/ul>/);assert.match(out,/Ship To<\/div><ul[^>]*><li>Name<\/li><\/ul>/);assert.match(out,/<li>Free State Order Email<\/li>/);assert.doesNotMatch(out,/Bill To: /);
});

test('Free State: saving settings and sending do not depend on reading back a write made in the same run',()=>{
  const f = fsFixture(true), realGet = f.c.getSheet, frozen = structuredClone(f.tables.Config);
  f.c.getSheet = name => name === 'Config' ? {getSheetId:()=>realGet('Config').getSheetId(),getDataRange:()=>({getValues:()=>frozen.map(r=>r.slice())})} : realGet(name);
  const saved = f.c.saveFreeStateSettings(FS_VALUES,'test');
  assert.equal(saved.success,true);assert.equal(saved.missing.length,0);
  f.c.getSheet = realGet;
  const g = fsFixture(), p = g.preview(), realOpen = g.c.SpreadsheetApp.openById, stale = {};
  g.c.SpreadsheetApp.openById = id => { const ss = realOpen(id); return {insertSheet:n=>ss.insertSheet(n),getSheetByName:n=>{const s=ss.getSheetByName(n);return !s||n!=='Free State Order Log'?s:{...s,getDataRange:()=>({getValues:()=>(stale.v ||= s.getDataRange().getValues().map(r=>r.slice()))})};}}; };
  const r = g.c.sendFreeStateOrder(p.previewId,'test');
  assert.equal(r.success,true);assert.equal(g.emails.length,1);assert.equal(g.log()[1][2],'Recorded');assert.equal(g.history().length,4);
});

test('Free State edit screen: an added product sits at the bottom, then the order, review and email use item order',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[];
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},value:'',classList:{add(){},remove(){},contains(){return false;}},focus(){},insertAdjacentHTML(){}};}
  const storage={getItem:()=>null,setItem(){},removeItem(){}};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  const ids="JSON.stringify(fsDisplayLines().map(l=>l.itemId))", sent="JSON.stringify(fsPayload().map(l=>l.itemId))";
  vm.runInContext("sessionToken='fixture';dashboardSignedOut=false;renderInventory(demoCatalog);fs.lines=[{itemId:'P1',qty:'5',requestedFor:'',manual:false},{itemId:'SP3101',qty:'2',requestedFor:'',manual:false}];fsAdd('B1');",c);
  assert.equal(vm.runInContext(ids,c),'["P1","SP3101","B1"]');assert.equal(vm.runInContext(sent,c),'["B1","P1","SP3101"]');
  vm.runInContext("fsLine('B1').qty='1';fsReview();",c);while(timers.length)timers.shift()();
  assert.equal(vm.runInContext(ids,c),'["B1","P1","SP3101"]');assert.equal(vm.runInContext(sent,c),'["B1","P1","SP3101"]');
});

test('Inventory screen: Order on Request products show no count and no inventory type control',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[];
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},value:'',classList:{add(){},remove(){},contains(){return false;}},focus(){},insertAdjacentHTML(){}};}
  const storage={getItem:()=>null,setItem(){},removeItem(){}};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  vm.runInContext("sessionToken='fixture';dashboardSignedOut=false;renderInventory([{itemId:'B1',name:'Basic Text',category:'Books',price:1,stock:1,lowAt:5,inventoryType:'Stocked',active:true},{itemId:'S1',name:'Spanish Text',category:'Spanish Lit',price:1,stock:0,lowAt:5,inventoryType:'Order on Request',active:true}]);",c);
  const page=elements['inventory-content'].innerHTML;
  assert.doesNotMatch(page,/Inventory type|<select/i);assert.match(page,/On request/);assert.match(page,/id="inv-B1"/);assert.doesNotMatch(page,/id="inv-S1"/);
});

test('Plus and minus buttons: Inventory counts (may go below zero, restyle and autosave) and Free State quantities (never below zero, kept in the draft)',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[], store=new Map();
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},value:'',dataset:{},classList:{add(){},remove(){},contains(){return false;},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},getAttribute(){return null;},querySelector:()=>null,insertAdjacentHTML(where,s){this.innerHTML+=s;}};}
  const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),get length(){return store.size;},key:i=>Array.from(store.keys())[i]};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,
    setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  function flush(){let n=0;while(timers.length){assert.ok(n++<30,'callbacks must settle');timers.shift()();}}
  vm.runInContext("sessionToken='fixture';dashboardSignedOut=false;renderInventory(demoCatalog);",c);
  const page=elements['inventory-content'].innerHTML;
  assert.match(page,/qty-wrap compact/);assert.match(page,/changeStock\('B1',-1\)/);assert.match(page,/changeStock\('B1',1\)/);
  const stock=()=>Number(element('inv-B1').value);
  element('inv-B1').closest=()=>null;(function(){let v='';Object.defineProperty(element('inv-B1'),'value',{get:()=>v,set:x=>{v=String(x);}});})();element('inv-B1').value='0';element('inv-B1').dataset={itemId:'B1',original:'0',lowAt:'5'};
  vm.runInContext("changeStock('B1',-1)",c);assert.equal(stock(),-1);
  vm.runInContext("changeStock('B1',1);changeStock('B1',1);changeStock('B1',1)",c);assert.equal(stock(),2);
  element('inv-B1').value='';vm.runInContext("changeStock('B1',1)",c);assert.equal(stock(),1);element('inv-B1').value='';
  assert.ok(timers.length>0,'a change schedules the autosave');
  vm.runInContext("openFreeStateOrder()",c);flush();
  const screen=elements['fs-order'].innerHTML;
  assert.match(screen,/fsStep\('B1',-1\)/);assert.match(screen,/fsStep\('B1',1\)/);assert.match(screen,/id="fs-qty-B1"/);
  const qty=()=>vm.runInContext("fsLine('B1').qty",c);
  assert.equal(qty(),'7');
  vm.runInContext("fsStep('B1',1)",c);assert.equal(qty(),'8');assert.equal(elements['fs-qty-B1'].value,'8');assert.match(store.get('norvana_fs_draft'),/"qty":"8"/);
  vm.runInContext("for(var i=0;i<20;i++)fsStep('B1',-1)",c);assert.equal(qty(),'0');
  vm.runInContext("fsLine('B1').qty='';fsStep('B1',1)",c);assert.equal(qty(),'1');
  vm.runInContext("fsLine('B1').qty='9999';fsStep('B1',1)",c);assert.equal(qty(),'9999');
});

test('Completed tab: opens on the current meeting month, the dropdown looks back, and the count follows the chosen month',()=>{
  const html=require('./preview.cjs').renderPreview(), elements={}, timers=[], store=new Map();
  function element(id){return elements[id] ||= {innerHTML:'',textContent:'',style:{},value:'',dataset:{},classList:{add(){},remove(){},contains(){return false;},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},getAttribute(){return null;},querySelector:()=>null,insertAdjacentHTML(where,s){this.innerHTML+=s;}};}
  const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),get length(){return store.size;},key:i=>Array.from(store.keys())[i]};
  const c=vm.createContext({console,Date,Number,Set,Map,Math,JSON,Object,Array,String,Proxy,
    setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},localStorage:storage,sessionStorage:storage,
    document:{body:element('body'),getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(m[1],c,{filename:'assembled-preview.html'});
  function flush(){let n=0;while(timers.length){assert.ok(n++<30,'callbacks must settle');timers.shift()();}}
  const order=(id,status,month,group)=>({orderId:id,status:status,meetingMonth:month,groupName:group,contact:'',email:'',phone:'',estimatedTotal:10,fulfilledTotal:10,timestamp:'Oct 1',itemCount:1,revision:2});
  c.ORDERS=[order('NL-2610-003','Completed','October 2026','Group B'),order('NL-2610-002','Completed','October 2026','Group A'),order('NL-2609-001','Completed','September 2026','Group C'),order('NL-2512-001','Completed','December 2025','Group D'),order('NL-2611-001','New','November 2026','Group E')];
  vm.runInContext("meetingMonth='November 2026';allOrders=ORDERS;currentFilter='Completed';updateStats();renderOrderList();",c);
  assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(completedMonthOptions())",c)),['November 2026','October 2026','September 2026','December 2025']);
  let list=elements['orders-list'].innerHTML;
  assert.match(list,/<option value="November 2026" selected>/);assert.match(list,/No completed orders for November 2026/);assert.doesNotMatch(list,/Group [ABCD]/);
  assert.equal(elements['stat-completed'].textContent,0);
  vm.runInContext("setCompletedMonth('October 2026')",c);
  list=elements['orders-list'].innerHTML;
  assert.match(list,/<option value="October 2026" selected>/);assert.match(list,/Group A/);assert.match(list,/Group B/);assert.doesNotMatch(list,/Group C|Group D|Group E/);
  assert.equal(elements['stat-completed'].textContent,2);
  vm.runInContext("setCompletedMonth('December 2025')",c);assert.match(elements['orders-list'].innerHTML,/Group D/);assert.equal(elements['stat-completed'].textContent,1);
  // The other tabs are unchanged: All hides Completed, New shows New, and neither shows the month picker.
  vm.runInContext("currentFilter='All';renderOrderList()",c);list=elements['orders-list'].innerHTML;assert.match(list,/Group E/);assert.doesNotMatch(list,/Group [ABCD]|completed-month/);
  // No schedule month known (before sign-in): fall back to the newest month that has Completed orders.
  vm.runInContext("meetingMonth='Current';completedMonth=null;currentFilter='Completed';renderOrderList()",c);assert.match(elements['orders-list'].innerHTML,/<option value="October 2026" selected>/);
});
