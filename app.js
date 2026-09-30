const SUPABASE_URL='https://znzgumiwgmidfctdpxkq.supabase.co';
const SUPABASE_KEY='sb_publishable_PVSqrL2kXWFLxuXUGDl-FQ_gX55Cn16';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let currentCase=null, currentUser=null;
const $=id=>document.getElementById(id);
function show(id){document.querySelectorAll('main section').forEach(s=>s.classList.add('hidden'));$(id).classList.remove('hidden')}
async function boot(){const {data:{session}}=await sb.auth.getSession(); if(!session){show('login');return;} currentUser=session.user; $('who').textContent=currentUser.email; show('dashboard'); await loadCases();}
async function signIn(e){e.preventDefault();$('loginMsg').textContent='Signing in…';const {error}=await sb.auth.signInWithPassword({email:$('email').value,password:$('password').value}); if(error){$('loginMsg').textContent=error.message;return;} await boot();}
async function logout(){await sb.auth.signOut();location.reload()}
async function loadCases(){const {data,error}=await sb.from('case_workspace').select('*').order('updated_at',{ascending:false});if(error){$('queue').innerHTML=`<tr><td colspan=4>${error.message}</td></tr>`;return;}const rows=data||[];$('mActive').textContent=rows.length;$('mQR').textContent=rows.filter(x=>x.status==='ready_for_quality_review').length;$('mWait').textContent=rows.filter(x=>['waiting_on_taxpayer','waiting_on_documents'].includes(x.status)).length;$('mTransmit').textContent=rows.filter(x=>x.status==='ready_to_transmit').length;const html=rows.map(x=>`<tr onclick="openCase('${x.case_id}')"><td><b>${esc(x.first_name)} ${esc(x.last_name)}</b></td><td>${x.tax_year}</td><td><span class=status>${pretty(x.status)}</span></td><td>${esc(x.next_action||'Open case')}</td></tr>`).join('')||'<tr><td colspan=4>No cases available for this account.</td></tr>';$('queue').innerHTML=html;$('clientRows').innerHTML=html.replaceAll('colspan=4','colspan=5');}
async function openCase(id){currentCase=id;show('case');const {data}=await sb.from('case_workspace').select('*').eq('case_id',id).single();$('caseName').textContent=`${data.first_name} ${data.last_name}`;$('caseMeta').textContent=`Tax Year ${data.tax_year} · ${pretty(data.status)}`;$('caseStatus').textContent=pretty(data.status);$('nextAction').textContent=data.next_action||'Review current controls.';await Promise.all([loadForms(),loadDD(),loadNotes(),loadScopeEstimate()]);}
async function loadForms(){const {data}=await sb.from('case_form_queue').select('*').eq('case_id',currentCase).order('code');$('forms').innerHTML=(data||[]).map(f=>`<div class=row><b>${esc(f.code)}</b><span>${esc(f.full_name)} <small>— ${pretty(f.status)}</small></span></div>`).join('')||'No routed forms.'}
async function loadDD(){const {data}=await sb.from('due_diligence_answers').select('id,credit_type,question_label,draft_answer,preparer_answer,evidence_status').eq('case_id',currentCase).order('credit_type');$('ddAnswers').innerHTML=(data||[]).map(a=>`<div class="dditem"><div><b>${esc(a.credit_type)} — ${esc(a.question_label)}</b><span class="status ${a.evidence_status==='supported'?'green':'amber'}">${pretty(a.evidence_status)}</span></div><textarea id="ans-${a.id}" placeholder="Preparer response">${esc(a.preparer_answer||a.draft_answer||'')}</textarea><div class=ddactions><button class=secondary onclick="saveAnswer('${a.id}')">Save</button><button class=action onclick="copyAnswer('${a.id}')">Copy Answer</button></div></div>`).join('')||'<div class=muted>No due-diligence questions have been generated for this case yet.</div>'}
async function saveAnswer(id){const val=$(`ans-${id}`).value;const {error}=await sb.from('due_diligence_answers').update({preparer_answer:val,reviewed_by:currentUser.id,reviewed_at:new Date().toISOString()}).eq('id',id);toast(error?error.message:'Answer saved.');}
async function copyAnswer(id){const {data,error}=await sb.rpc('copy_ready_due_diligence',{p_answer:id});if(error)return toast(error.message);await navigator.clipboard.writeText(data||'PREPARER RESPONSE REQUIRED');toast(data==='PREPARER RESPONSE REQUIRED'?'Preparer review required before use.':'Copy-ready answer copied.');}
async function loadNotes(){const {data}=await sb.from('preparer_case_notes').select('*').eq('case_id',currentCase).order('created_at',{ascending:false});$('noteHistory').innerHTML=(data||[]).map(n=>`<div class=audit><b>${n.note_type==='misc_private'?'Private Misc. Note':'Due Diligence Note'}</b><div>${esc(n.note_text)}</div></div>`).join('')||'<div class=muted>No internal notes yet.</div>'}
async function addNote(type){const box=type==='misc_private'?'miscNote':'ddNote',val=$(box).value.trim();if(!val)return;const {error}=await sb.from('preparer_case_notes').insert({case_id:currentCase,author_user_id:currentUser.id,note_type:type,note_text:val,is_private:true});if(error)return toast(error.message);$(box).value='';await loadNotes();toast('Private internal note saved.');}
function nav(id,btn){show(id);document.querySelectorAll('.side button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');if(id==='clients')loadCases()}
function pretty(v){return (v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2400)}
document.addEventListener('DOMContentLoaded',boot);

let myFirms=[], routingTriggers=[];
async function loadPortalContext(){
  const [{data:firms,error:fe},{data:triggers,error:te}]=await Promise.all([
    sb.from('my_firm_roles').select('*').order('firm_name'),
    sb.from('routing_trigger_catalog').select('*').order('trigger_label')
  ]);
  myFirms=firms||[]; routingTriggers=triggers||[];
  const canCreate=myFirms.some(f=>f.role==='administrator' && f.active);
  const b=$('newCaseBtn'); if(b) b.classList.toggle('hidden',!canCreate);
  const ab=$('adminNavBtn'); if(ab) ab.classList.toggle('hidden',!canCreate);
  if(fe) toast(fe.message); if(te) console.warn(te.message);
}
async function openNewCase(){
  await loadPortalContext();
  const admins=myFirms.filter(f=>f.role==='administrator'&&f.active);
  if(!admins.length){toast('Administrator access is required to create a taxpayer case.');return;}
  $('caseFirm').innerHTML=admins.map(f=>`<option value="${esc(f.firm_id)}">${esc(f.firm_name)}</option>`).join('');
  $('newTaxYear').value=new Date().getFullYear()-1;
  $('triggerList').innerHTML=routingTriggers.map(t=>`<label class="check"><input type="checkbox" class="routeTrigger" value="${esc(t.trigger_key)}"><span><b>${esc(t.trigger_label||pretty(t.trigger_key))}</b><br><small>${t.routed_form_count} routed form${Number(t.routed_form_count)===1?'':'s'}</small></span></label>`).join('')||'<div class=muted>No specialty routing rules available.</div>';
  $('newCaseMsg').textContent=''; show('newcase');
}
async function createCase(e){
  e.preventDefault();
  const msg=$('newCaseMsg'); msg.textContent='Creating taxpayer and return…';
  const params={p_firm:$('caseFirm').value,p_first_name:$('newFirst').value.trim(),p_last_name:$('newLast').value.trim(),p_email:$('newEmail').value.trim()||null,p_phone:$('newPhone').value.trim()||null,p_tax_year:Number($('newTaxYear').value)};
  const {data,error}=await sb.rpc('create_tax_case',params);
  if(error){msg.textContent=error.message;return;}
  const caseId=typeof data==='string'?data:(data?.id||data?.case_id||data);
  if(!caseId){msg.textContent='Case was created, but the case identifier was not returned.';await loadCases();return;}
  const selected=[...document.querySelectorAll('.routeTrigger:checked')].map(x=>x.value);
  for(const key of selected){const {error:re}=await sb.rpc('set_case_trigger',{p_case:caseId,p_trigger_key:key,p_active:true});if(re){msg.textContent=`Case created. Routing warning: ${re.message}`;await loadCases();await openCase(caseId);return;}}
  msg.textContent='Case created and routed.'; await loadCases(); await openCase(caseId); toast('New taxpayer return created.');
}
const _boot=boot;
boot=async function(){await _boot();if(currentUser)await loadPortalContext();};
const intakeMap={
 iDependents:['due_diligence','dependents'],iChildcare:['due_diligence'],iEducation:['education','due_diligence'],
 iW2:['w2'],iBusiness:['business_income'],iBusinessAsset:['business_asset'],iMissing:['missing_records'],
 iRental:['rental'],iRentalAsset:['rental_asset'],iInvestment:['investment'],iRetirement:['retirement'],
 iPrior:['prior_year_amended'],iRealEstate:['real_estate_transaction'],iK1:['k1'],iHsa:['hsa'],
 iOther:['other_income_special'],iForeign:['foreign'],iEstimated:['estimated_extension_balance'],iMarketplace:['marketplace']
};
let intakeFormId=null;
async function openIntake(){
 if(!currentCase)return;
 const {data,error}=await sb.from('case_form_queue').select('case_form_id,code,status').eq('case_id',currentCase).eq('code','PGI-001/CT-001').maybeSingle();
 if(error)return toast(error.message); if(!data)return toast('PGI-001 / CT-001 — Elite Client Interview is not routed to this case.');
 intakeFormId=data.case_form_id;
 const {data:raw,error:re}=await sb.from('case_forms').select('response,status').eq('id',intakeFormId).single(); if(re)return toast(re.message);
 const r=raw?.response||{};
 $('iHousehold').value=r.household_notes||'';$('iNotices').value=r.notices||'';$('iDocs').value=r.documents_needed||'';$('iNotes').value=r.additional_information||'';$('iAck').checked=!!r.client_acknowledgment;
 Object.keys(intakeMap).forEach(id=>{$(id).checked=!!r.answers?.[id]});
 $('intakeMsg').textContent=raw?.status==='completed'?'Previously submitted. You may update answers and resubmit if needed.':'';show('intake');
}
function intakePayload(){const answers={};Object.keys(intakeMap).forEach(id=>answers[id]=$(id).checked);return {household_notes:$('iHousehold').value.trim(),notices:$('iNotices').value.trim(),documents_needed:$('iDocs').value.trim(),additional_information:$('iNotes').value.trim(),answers,client_acknowledgment:$('iAck').checked,updated_at:new Date().toISOString()};}
async function saveIntake(complete){
 if(!intakeFormId)return;
 const payload=intakePayload(); const upd={response:payload,status:complete?'completed':'in_progress',completed_at:complete?new Date().toISOString():null};
 const {error}=await sb.from('case_forms').update(upd).eq('id',intakeFormId); if(error){$('intakeMsg').textContent=error.message;return false;}
 if(complete){
   const keys=new Set();Object.entries(intakeMap).forEach(([id,ks])=>{if($(id).checked)ks.forEach(k=>keys.add(k));});
   if($('iNotices').value.trim()) keys.add('other_income_special');
   for(const key of keys){const {error:re}=await sb.rpc('set_case_trigger',{p_case:currentCase,p_trigger_key:key,p_active:true});if(re){$('intakeMsg').textContent=`Intake saved. Routing warning for ${pretty(key)}: ${re.message}`;return false;}}
 }
 $('intakeMsg').textContent=complete?'Intake submitted. Required specialty interviews and workpapers were routed from the answers above.':'Draft saved.';toast(complete?'Intake submitted and routed.':'Intake draft saved.');return true;
}
async function submitIntake(e){e.preventDefault();if(!$('iAck').checked)return;const ok=await saveIntake(true);if(ok){await loadCases();await loadForms();}}

// Build 5C — Smart PGI-001 / CT-001 intake
const smartDocRules=[
 ['identity','Identity documents / taxpayer identification',()=>true],
 ['w2','All W-2 forms',()=>$('iW2').checked],
 ['business','1099 forms, income records, business expenses and mileage support',()=> $('iBusiness').checked],
 ['business_asset','Vehicle / equipment / asset purchase information',()=> $('iBusinessAsset').checked],
 ['rental','Rental income, mortgage/tax/insurance and expense support',()=> $('iRental').checked],
 ['rental_asset','Rental basis, improvements and prior depreciation information',()=> $('iRentalAsset').checked],
 ['investment','Brokerage statements, 1099-B, crypto and basis records',()=> $('iInvestment').checked],
 ['retirement','SSA-1099, 1099-R and rollover/conversion records',()=> $('iRetirement').checked],
 ['education','1098-T, 1099-Q, tuition and scholarship records',()=> $('iEducation').checked],
 ['real_estate','Closing disclosure, 1099-S and property transaction records',()=> $('iRealEstate').checked],
 ['k1','Complete K-1 package and related statements',()=> $('iK1').checked],
 ['hsa','1099-SA, 5498-SA and HSA/MSA records',()=> $('iHsa').checked],
 ['marketplace','Form 1095-A',()=> $('iMarketplace').checked],
 ['foreign','Foreign income, account, tax and asset records',()=> $('iForeign').checked],
 ['estimated','Estimated-tax / extension payment confirmations',()=> $('iEstimated').checked],
 ['notice','Copy of each IRS or state notice',()=> $('iNotices').value.trim().length>0]
];
let smartDependents=[], smartProvidedDocs={};
function isMarriedIntake(){return ($('iFiling').value||'').toLowerCase().startsWith('married')}
function addDependent(d={}){smartDependents.push({name:d.name||'',relationship:d.relationship||'',dob:d.dob||'',months:d.months||'',student:!!d.student,disabled:!!d.disabled,support:d.support||''});renderDependents();refreshSmartIntake()}
function removeDependent(i){smartDependents.splice(i,1);renderDependents();refreshSmartIntake()}
function renderDependents(){
 $('dependentRows').innerHTML=smartDependents.map((d,i)=>`<div class="dependent"><div class="sectionhead"><b>Person ${i+1}</b><button class="secondary" type="button" onclick="removeDependent(${i})">Remove</button></div><div class="twocol"><div><label>Full name</label><input class="field depName" data-i="${i}" value="${esc(d.name)}"></div><div><label>Relationship</label><input class="field depRel" data-i="${i}" value="${esc(d.relationship)}" placeholder="Child, parent, other…"></div><div><label>Date of birth</label><input type="date" class="field depDob" data-i="${i}" value="${esc(d.dob)}"></div><div><label>Months lived with you</label><input type="number" min="0" max="12" class="field depMonths" data-i="${i}" value="${esc(d.months)}"></div></div><label class="check"><input type="checkbox" class="depStudent" data-i="${i}" ${d.student?'checked':''}><span>Full-time student during the year</span></label><label class="check"><input type="checkbox" class="depDisabled" data-i="${i}" ${d.disabled?'checked':''}><span>Permanently and totally disabled</span></label><label>Support / custody / residency details or questions</label><textarea class="field depSupport" data-i="${i}" rows="2">${esc(d.support)}</textarea></div>`).join('')||'<div class="muted">Add each dependent or qualifying person you may claim.</div>';
 document.querySelectorAll('#dependentRows input,#dependentRows textarea').forEach(el=>el.addEventListener('input',()=>{captureDependents();refreshSmartIntake()}));
}
function captureDependents(){smartDependents=smartDependents.map((d,i)=>({name:document.querySelector(`.depName[data-i="${i}"]`)?.value.trim()||'',relationship:document.querySelector(`.depRel[data-i="${i}"]`)?.value.trim()||'',dob:document.querySelector(`.depDob[data-i="${i}"]`)?.value||'',months:document.querySelector(`.depMonths[data-i="${i}"]`)?.value||'',student:!!document.querySelector(`.depStudent[data-i="${i}"]`)?.checked,disabled:!!document.querySelector(`.depDisabled[data-i="${i}"]`)?.checked,support:document.querySelector(`.depSupport[data-i="${i}"]`)?.value.trim()||''}))}
function renderSmartDocs(){const active=smartDocRules.filter(x=>x[2]());$('smartDocs').innerHTML=active.map(([k,label])=>`<label class="docitem"><input type="checkbox" class="smartDoc" data-key="${k}" ${smartProvidedDocs[k]?'checked':''} onchange="smartProvidedDocs['${k}']=this.checked;refreshSmartIntake()"><span>${esc(label)}</span></label>`).join('')}
function refreshSmartIntake(){
 $('spousePanel').classList.toggle('hidden',!isMarriedIntake());$('dependentPanel').classList.toggle('hidden',!$('iDependents').checked);$('businessPanel').classList.toggle('hidden',!$('iBusiness').checked);$('rentalPanel').classList.toggle('hidden',!$('iRental').checked);
 if($('iDependents').checked&&!smartDependents.length)addDependent(); renderSmartDocs();
 const req=[!!$('iFiling').value,$('iAck').checked]; if(isMarriedIntake())req.push(!!$('iSpouseFirst').value.trim(),!!$('iSpouseLast').value.trim()); if($('iDependents').checked)req.push(smartDependents.length>0,smartDependents.every(d=>d.name&&d.relationship));
 const pct=Math.round(req.filter(Boolean).length/req.length*100);$('intakeProgress').textContent=`${pct}% Required Items`;$('intakeProgress').className='pill '+(pct===100?'progressok':'progresswarn');
 const missing=[];if(!$('iFiling').value)missing.push('filing situation');if(isMarriedIntake()&&(!$('iSpouseFirst').value.trim()||!$('iSpouseLast').value.trim()))missing.push('spouse name');if($('iDependents').checked&&!smartDependents.every(d=>d.name&&d.relationship))missing.push('dependent name/relationship');if(!$('iAck').checked)missing.push('client acknowledgment');
 const openDocs=smartDocRules.filter(x=>x[2]()&&!smartProvidedDocs[x[0]]).map(x=>x[1]);$('intakeGate').innerHTML=missing.length?`<b>Required before submission:</b> ${esc(missing.join(', '))}.`:(openDocs.length?`<b>Intake can be submitted.</b> ${openDocs.length} document item${openDocs.length===1?' is':'s are'} still marked as outstanding and will remain visible for follow-up.`:'<b>Ready to submit.</b> Required intake items and document checklist are complete.');
 $('intakeSubmitBtn').disabled=missing.length>0;
}
function smartIntakePayload(){captureDependents();const base=intakePayload();base.filing_situation=$('iFiling').value;base.spouse=isMarriedIntake()?{first_name:$('iSpouseFirst').value.trim(),last_name:$('iSpouseLast').value.trim(),notes:$('iSpouseNotes').value.trim()}:null;base.dependents=$('iDependents').checked?smartDependents:[];base.business_summary=$('iBusinessSummary').value.trim();base.document_checklist=Object.fromEntries(smartDocRules.filter(x=>x[2]()).map(x=>[x[0],{label:x[1],provided:!!smartProvidedDocs[x[0]]}]));base.outstanding_documents=Object.values(base.document_checklist).filter(x=>!x.provided).map(x=>x.label);return base}
const _openIntake=openIntake;
openIntake=async function(){await _openIntake();if($('intake').classList.contains('hidden'))return;const {data}=await sb.from('case_forms').select('response').eq('id',intakeFormId).single();const r=data?.response||{};$('iFiling').value=r.filing_situation||'';$('iSpouseFirst').value=r.spouse?.first_name||'';$('iSpouseLast').value=r.spouse?.last_name||'';$('iSpouseNotes').value=r.spouse?.notes||'';$('iBusinessSummary').value=r.business_summary||'';smartDependents=Array.isArray(r.dependents)?r.dependents:[];smartProvidedDocs={};Object.entries(r.document_checklist||{}).forEach(([k,v])=>smartProvidedDocs[k]=!!v.provided);renderDependents();refreshSmartIntake();await loadUploadedDocs();}
const _intakePayload=intakePayload;intakePayload=smartIntakePayload;
const _submitIntake=submitIntake;submitIntake=async function(e){captureDependents();refreshSmartIntake();if($('intakeSubmitBtn').disabled){e.preventDefault();toast('Complete the required intake items before submitting.');return;}await _submitIntake(e)};
async function uploadIntakeDocument(){const f=$('intakeUpload').files?.[0];if(!f)return toast('Choose a document first.');if(f.size>25*1024*1024)return toast('File exceeds the 25 MB case-document limit.');$('uploadStatus').textContent='Uploading securely…';const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${currentCase}/${crypto.randomUUID()}-${safe}`;const {error:ue}=await sb.storage.from('prodesk-case-documents').upload(path,f,{upsert:false});if(ue){$('uploadStatus').textContent=ue.message;return;}const {error:de}=await sb.from('documents').insert({case_id:currentCase,uploaded_by:currentUser.id,storage_path:path,document_type:$('uploadType').value,original_filename:f.name});if(de){$('uploadStatus').textContent=`File uploaded, but document index failed: ${de.message}`;return;}$('intakeUpload').value='';$('uploadStatus').textContent='Uploaded to the secure case file.';await loadUploadedDocs();toast('Document uploaded.');}
async function loadUploadedDocs(){const {data,error}=await sb.from('documents').select('id,document_type,original_filename,created_at').eq('case_id',currentCase).order('created_at',{ascending:false});$('uploadedDocs').innerHTML=error?`<div class="muted">${esc(error.message)}</div>`:(data||[]).slice(0,8).map(d=>`<div class="row"><b>${esc(pretty(d.document_type||'other'))}</b><span>${esc(d.original_filename||'Document')}</span></div>`).join('')||'<div class="muted">No case documents uploaded yet.</div>'}

// Build 5D — Scope, engagement, and payment gate
async function loadScopeEstimate(){
 if(!currentCase||!$('scopeEstimate'))return;
 const {data,error}=await sb.from('case_scope_estimates').select('*').eq('case_id',currentCase).maybeSingle();
 if(error){$('scopeEstimate').textContent=error.message;return;}
 if(!data){$('scopeEstimate').innerHTML='No EC-001 estimate generated yet.';return;}
 $('scopePaymentMethod').value=data.payment_method||'direct_pay';
 const items=(data.services||[]).map(x=>`<div class=row><span>${esc(x.name)}</span><b>${x.starting_price==null?'Pricing required':money(x.starting_price)}</b></div>`).join('');
 $('scopeEstimate').innerHTML=`${items}<div class=row><span>E-file & delivery fee</span><b>${money(data.efile_delivery_fee)}</b></div><div class=row><span>Document / administration fee</span><b>${money(data.document_admin_fee)}</b></div>${Number(data.bank_product_fee)>0?`<div class=row><span>Bank-product service fee</span><b>${money(data.bank_product_fee)}</b></div>`:''}<div class=row><span><b>Estimated Total</b></span><b>${money(data.estimated_total)}</b></div><div class=row><span>Required deposit</span><b>${money(data.deposit_required)}</b></div><p class=muted>${esc(data.contingency_note||'')}</p>${data.issued_at?'<span class="status green">EC-001 Issued</span>':''}${data.client_authorized_at?' <span class="status green">EC-002 Authorized</span>':''}`;
}
async function buildScopeEstimate(){
 const method=$('scopePaymentMethod').value;
 const {data,error}=await sb.rpc('build_case_scope_estimate',{p_case:currentCase,p_payment_method:method});
 if(error)return toast(error.message);await loadScopeEstimate();toast('Scope and fee estimate refreshed.');
}
async function issueEngagement(){
 const {error}=await sb.rpc('issue_case_engagement',{p_case:currentCase});if(error)return toast(error.message);await Promise.all([loadScopeEstimate(),loadCases()]);await openCase(currentCase);toast('EC-001 issued; EC-002 authorization is now required.');
}
async function recordPaymentPrompt(){
 const raw=prompt('Payment amount received:');if(raw===null)return;const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0)return toast('Enter a valid payment amount.');
 const {error}=await sb.rpc('record_case_payment',{p_case:currentCase,p_amount:amount});if(error)return toast(error.message);await Promise.all([loadScopeEstimate(),loadCases()]);await openCase(currentCase);toast('Payment recorded and preparation gate recalculated.');
}
function money(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0))}


// Build 5C — administrator-managed pricing
async function openPricingAdmin(btn){
  await loadPortalContext();
  const admins=myFirms.filter(f=>f.role==='administrator'&&f.active);
  if(!admins.length)return toast('Administrator access is required for Pricing Administration.');
  $('pricingFirm').innerHTML=admins.map(f=>`<option value="${esc(f.firm_id)}">${esc(f.firm_name)}</option>`).join('');
  show('pricingadmin');document.querySelectorAll('.side button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');
  await loadPricingAdmin();
}
async function loadPricingAdmin(){
  const firm=$('pricingFirm')?.value;if(!firm)return;
  const [{data:settings,error:se},{data:services,error:pe}]=await Promise.all([
    sb.from('firm_pricing_settings').select('*').eq('firm_id',firm).maybeSingle(),
    sb.from('service_pricing').select('*').eq('firm_id',firm).order('sort_order').order('service_name')
  ]);
  if(se)return toast(se.message);if(pe)return toast(pe.message);
  $('feeEfile').value=settings?.efile_delivery_fee??75;
  $('feeAdmin').value=settings?.document_admin_fee??75;
  $('feeDepositPct').value=settings?.direct_pay_deposit_percent??50;
  $('feeBankProduct').value=settings?.bank_product_fee??0;
  $('feePaymentUrl').value=settings?.direct_payment_url??'';
  $('servicePricingRows').innerHTML=(services||[]).map(s=>`<div class="row" style="grid-template-columns:1fr 180px"><span><b>${esc(s.service_name)}</b><br><small>${esc(pretty(s.service_key))}</small></span><input class="field servicePrice" style="margin:0" data-id="${esc(s.id)}" type="number" min="0" step="0.01" value="${s.starting_price==null?'':esc(s.starting_price)}" placeholder="Starting price required"></div>`).join('')||'<div class=muted>No service pricing rows are configured for this firm.</div>';
}
async function saveFirmPricing(){
  const firm=$('pricingFirm').value;
  const vals={firm_id:firm,efile_delivery_fee:Number($('feeEfile').value),document_admin_fee:Number($('feeAdmin').value),direct_pay_deposit_percent:Number($('feeDepositPct').value),bank_product_fee:Number($('feeBankProduct').value||0),direct_payment_url:$('feePaymentUrl').value.trim()||null,updated_at:new Date().toISOString()};
  if([vals.efile_delivery_fee,vals.document_admin_fee,vals.direct_pay_deposit_percent,vals.bank_product_fee].some(v=>!Number.isFinite(v)||v<0)||vals.direct_pay_deposit_percent>100)return toast('Check the pricing-control values.');
  const {error}=await sb.from('firm_pricing_settings').upsert(vals,{onConflict:'firm_id'});if(error)return toast(error.message);toast('Firm pricing controls saved.');
}
async function saveServicePricing(){
  const inputs=[...document.querySelectorAll('.servicePrice')];
  const missing=inputs.filter(i=>i.value.trim()==='');if(missing.length)return toast(`Set a starting price for all ${missing.length} remaining service${missing.length===1?'':'s'}.`);
  for(const i of inputs){const price=Number(i.value);if(!Number.isFinite(price)||price<0)return toast('Service prices must be zero or greater.');const {error}=await sb.from('service_pricing').update({starting_price:price}).eq('id',i.dataset.id);if(error)return toast(error.message);}
  toast('Service starting prices saved.');await loadPricingAdmin();
}

// Build 5E — taxpayer-facing EC-001 / EC-002 and payment handoff
async function loadTaxpayerEngagementNav(){
  const {data,error}=await sb.from('taxpayer_engagement_workspace').select('case_id').limit(1);
  const b=$('taxpayerEngagementNav');if(b)b.classList.toggle('hidden',!!error||!(data||[]).length);
}
async function openMyEngagement(btn){
  show('taxpayerengagement');document.querySelectorAll('.side button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');
  const {data,error}=await sb.from('taxpayer_engagement_workspace').select('*').order('tax_year',{ascending:false});
  if(error){$('taxEngagementList').innerHTML=`<div class='card'>${esc(error.message)}</div>`;return;}
  $('taxEngagementList').innerHTML=(data||[]).map(renderTaxpayerEngagement).join('')||"<div class='card muted'>No issued engagement is available yet.</div>";
}
function renderTaxpayerEngagement(x){
  if(!x.issued_at)return `<div class='card'><h3>${esc(x.first_name)} ${esc(x.last_name)} — Tax Year ${esc(x.tax_year)}</h3><div class='alert'>Your scope and fee estimate has not been issued yet.</div></div>`;
  const services=(x.services||[]).map(v=>`<div class='row'><span>${esc(v.name)}</span><b>${money(v.starting_price)}</b></div>`).join('');
  const method=x.payment_method||'direct_pay';
  const auth=x.client_authorized_at;
  const pay=method==='direct_pay'?`<div class='alert'><b>Direct-pay requirement:</b> ${money(x.deposit_required)} deposit is required before preparation may begin. Amount recorded: ${money(x.amount_collected)}.</div>${auth&&x.direct_payment_url?`<button class='action' onclick="openSecurePayment('${escAttr(x.direct_payment_url)}')">Continue to Secure Payment</button>`:auth?`<div class='muted'>Online checkout is not configured. Follow your firm's payment instructions.</div>`:''}`:`<div class='alert'><b>Pay-from-refund selection:</b> Your engagement includes the configured bank-product service amount shown below. Provider/third-party charges, if applicable, remain separate.</div>`;
  const chooser=!auth?`<label>How would you like to pay?</label><select id='taxPay-${x.case_id}' class='field' onchange="chooseTaxpayerPayment('${x.case_id}')"><option value='direct_pay' ${method==='direct_pay'?'selected':''}>Direct Pay / Pay Up Front</option><option value='bank_product' ${method==='bank_product'?'selected':''}>Pay From Refund / Bank Product</option></select>`:'';
  const authorize=!auth?`<div class='card' style='margin-top:14px;background:#fafafa'><h3>EC-002 — Engagement & Fee Authorization</h3><p class='muted'>By authorizing, you confirm that you reviewed the scope, estimated charges, payment method, and contingency language shown above. Additional work discovered later may require a separate scope-change authorization.</p><label>Type your full name</label><input id='taxName-${x.case_id}' class='field'><label class='check'><input id='taxAtt-${x.case_id}' type='checkbox'><span>I authorize the engagement and fee arrangement shown above.</span></label><button class='action' onclick="authorizeTaxpayerEngagement('${x.case_id}')">Authorize EC-002</button></div>`:`<span class='status green'>EC-002 Authorized</span>`;
  return `<div class='card' style='margin-bottom:16px'><div class='sectionhead'><div><h3>${esc(x.first_name)} ${esc(x.last_name)} — Tax Year ${esc(x.tax_year)}</h3><div class='muted'>EC-001 — Scope of Service & Fee Estimate</div></div><span class='status'>${esc(pretty(x.status))}</span></div>${services}<div class='row'><span>E-file & delivery fee</span><b>${money(x.efile_delivery_fee)}</b></div><div class='row'><span>Document / administration fee</span><b>${money(x.document_admin_fee)}</b></div>${Number(x.bank_product_fee)>0?`<div class='row'><span>Bank-product service fee</span><b>${money(x.bank_product_fee)}</b></div>`:''}<div class='row'><span><b>Estimated total</b></span><b>${money(x.estimated_total)}</b></div><p class='muted'>${esc(x.contingency_note||'')}</p>${chooser}${pay}${authorize}</div>`;
}
async function chooseTaxpayerPayment(caseId){
  const method=$(`taxPay-${caseId}`).value;const {error}=await sb.rpc('choose_engagement_payment_method',{p_case:caseId,p_payment_method:method});if(error)return toast(error.message);await openMyEngagement();toast('Payment method updated and estimate recalculated.');
}
async function authorizeTaxpayerEngagement(caseId){
  const name=$(`taxName-${caseId}`).value.trim(),att=$(`taxAtt-${caseId}`).checked;if(!name||!att)return toast('Type your full name and confirm the authorization.');
  const {error}=await sb.rpc('authorize_case_engagement',{p_case:caseId,p_typed_name:name,p_attestation:true});if(error)return toast(error.message);await Promise.all([openMyEngagement(),loadCases()]);toast('EC-002 authorization recorded.');
}
function openSecurePayment(url){try{const u=new URL(url);if(u.protocol!=='https:')throw new Error();window.open(u.toString(),'_blank','noopener,noreferrer')}catch{toast('The configured payment link is invalid.')}}
function escAttr(v){return String(v??'').replace(/[&'"<>]/g,c=>({'&':'&amp;',"'":'&#39;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]))}
const _boot5e=boot;boot=async function(){await _boot5e();if(currentUser)await loadTaxpayerEngagementNav();};

// Build 5F — Preparer Assignment + Taxpayer Data Entry workflow
let currentCaseFirm=null;
const _openCase5f=openCase;
openCase=async function(id){await _openCase5f(id);const {data}=await sb.from('case_workspace').select('firm_id').eq('case_id',id).single();currentCaseFirm=data?.firm_id||null;await Promise.all([loadCasePreparers(),loadDEProgress()]);};
async function openDataEntryQueue(btn){show('dataentryqueue');document.querySelectorAll('.side button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');const {data,error}=await sb.from('preparer_queue').select('*').order('tax_year',{ascending:false});if(error){$('dataEntryRows').innerHTML=`<tr><td colspan='6'>${esc(error.message)}</td></tr>`;return;}const rows=(data||[]).filter(x=>['authorized_for_prep','in_preparation','taxpayer_data_entry_in_progress','data_entry_hold','ready_for_quality_review'].includes(x.status));$('dataEntryRows').innerHTML=rows.map(x=>`<tr onclick="openCase('${x.case_id}')"><td><b>${esc(x.first_name)} ${esc(x.last_name)}</b></td><td>${esc(x.tax_year)}</td><td><span class='status'>${esc(pretty(x.status))}</span></td><td>${x.preparer_id?'Assigned':'Unassigned'}</td><td>${Number(x.de_forms_completed||0)} / ${Number(x.de_forms_total||0)}</td><td>Open Case</td></tr>`).join('')||"<tr><td colspan='6'>No cases are currently in the Taxpayer Data Entry queue.</td></tr>";}
async function loadCasePreparers(){if(!$('casePreparer')||!currentCaseFirm)return;const [{data:members,error},{data:assigned}]=await Promise.all([sb.from('firm_members').select('user_id,role,active').eq('firm_id',currentCaseFirm).eq('role','preparer').eq('active',true),sb.from('case_assignments').select('user_id').eq('case_id',currentCase).eq('role','preparer').maybeSingle()]);if(error){$('casePreparer').innerHTML=`<option>${esc(error.message)}</option>`;return;}const ids=(members||[]).map(x=>x.user_id);let names={};if(ids.length){const {data:profiles}=await sb.from('profiles').select('id,full_name,email').in('id',ids);for(const p of profiles||[])names[p.id]=p.full_name||p.email||p.id;}$('casePreparer').innerHTML=`<option value=''>Select preparer</option>`+(members||[]).map(m=>`<option value='${m.user_id}' ${assigned?.user_id===m.user_id?'selected':''}>${esc(names[m.user_id]||m.user_id)}</option>`).join('');}
async function assignCurrentPreparer(){const uid=$('casePreparer').value;if(!uid)return toast('Select a preparer.');const {error}=await sb.rpc('assign_case_preparer',{p_case:currentCase,p_user:uid});if(error)return toast(error.message);await Promise.all([loadCasePreparers(),loadDEProgress(),loadForms()]);toast('Preparer assigned and routed DE workpapers updated.');}
async function loadDEProgress(){if(!$('deProgress')||!currentCase)return;const {data,error}=await sb.from('preparer_queue').select('*').eq('case_id',currentCase).maybeSingle();if(error||!data){$('deProgress').textContent=error?.message||'Taxpayer Data Entry controls unavailable.';return;}const total=Number(data.de_forms_total||0),done=Number(data.de_forms_completed||0);$('deProgress').innerHTML=`<b>DE workpapers:</b> ${done} of ${total} completed. ${data.de017_complete?'DE-017 complete.':'DE-017 pending.'}`;}
async function startCurrentDataEntry(){const {error}=await sb.rpc('start_taxpayer_data_entry',{p_case:currentCase});if(error)return toast(error.message);await Promise.all([loadCases(),loadDEProgress()]);await openCase(currentCase);toast('Taxpayer Data Entry started.');}
async function completeCurrentDE017(){if(!confirm('Confirm all routed DE workpapers are complete and diagnostics have been reviewed. Complete DE-017 — Final Data Entry Verification and send this case to Quality Review?'))return;const {error}=await sb.rpc('complete_de017_verification',{p_case:currentCase,p_diagnostics_reviewed:true});if(error)return toast(error.message);await Promise.all([loadCases(),loadForms(),loadDEProgress()]);await openCase(currentCase);toast('DE-017 completed. Case is Ready for Quality Review.');}


// v2.9 Quality Review
let qrRows=[];
async function loadQualityReviewQueue(){
 const {data,error}=await sb.from('quality_review_queue').select('*').order('tax_year',{ascending:false});
 if(error){toast(error.message,'error');return}
 qrRows=data||[];
 const sel=document.getElementById('qrCase'); if(sel) sel.innerHTML='<option value="">Select case</option>'+qrRows.map(r=>`<option value="${r.case_id}">${esc(r.last_name)}, ${esc(r.first_name)} — ${r.tax_year} — ${esc(r.status)}</option>`).join('');
 const q=document.getElementById('qrQueue'); if(q) q.innerHTML=qrRows.length?qrRows.map(r=>`<div class="queue-row"><strong>${esc(r.last_name)}, ${esc(r.first_name)}</strong> · ${r.tax_year}<br><span class="badge">${esc(r.status)}</span> <span class="muted">${esc(r.review_status||'not started')}</span>${r.qr_hold_active?' <span class="badge danger">QR HOLD</span>':''}<br><small>${esc(r.next_action||'')}</small></div>`).join(''):'<p class="muted">No cases currently in the Quality Review queue.</p>';
 await loadQrReviewers();
}
async function loadQrReviewers(){
 const roles=window.currentFirmRoles||[];
 const firm=(roles.find(x=>x.role==='administrator')||roles.find(x=>x.role==='ero')||roles[0]||{}).firm_id;
 if(!firm)return;
 const {data}=await sb.from('firm_members').select('user_id,role,profiles(full_name)').eq('firm_id',firm).eq('active',true).eq('role','reviewer');
 const s=document.getElementById('qrReviewer'); if(s)s.innerHTML='<option value="">Select reviewer</option>'+(data||[]).map(x=>`<option value="${x.user_id}">${esc(x.profiles?.full_name||x.user_id)}</option>`).join('');
}
function selectQrCase(){
 const id=document.getElementById('qrCase').value,r=qrRows.find(x=>x.case_id===id),d=document.getElementById('qrCaseSummary');
 if(!r){d.textContent='Select a case.';return}
 d.innerHTML=`<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong> · ${r.tax_year} · ${esc(r.status)}<br>${esc(r.next_action||'')}`;
 document.getElementById('qrNotes').value=r.reviewer_notes||'';
 document.getElementById('qrReviewer').value=r.reviewer_id||'';
}
async function assignQrReviewer(){const c=document.getElementById('qrCase').value,u=document.getElementById('qrReviewer').value;if(!c||!u)return toast('Select a case and reviewer.','error');const {error}=await sb.rpc('assign_case_reviewer',{p_case:c,p_user:u});if(error)return toast(error.message,'error');toast('Reviewer assigned.');loadQualityReviewQueue();}
function qrFindingArray(){return document.getElementById('qrFindings').value.split('\n').map(x=>x.trim()).filter(Boolean).map((text,i)=>({item:i+1,text,status:'open'}));}
async function submitQrHold(){const c=document.getElementById('qrCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('submit_quality_review',{p_case:c,p_result:'hold',p_notes:document.getElementById('qrNotes').value||null,p_findings:qrFindingArray()});if(error)return toast(error.message,'error');toast('QR Hold issued.');loadQualityReviewQueue();}
async function submitQrPass(){const c=document.getElementById('qrCase').value;if(!c)return toast('Select a case.','error');if(!confirm('Record QR PASS for this case? This advances the file to the signature stage.'))return;const {error}=await sb.rpc('submit_quality_review',{p_case:c,p_result:'pass',p_notes:document.getElementById('qrNotes').value||null,p_findings:qrFindingArray()});if(error)return toast(error.message,'error');toast('QR PASS recorded.');loadQualityReviewQueue();}
async function submitQrCorrections(){const c=document.getElementById('qrCase').value,n=document.getElementById('qrCorrectionResponse').value.trim();if(!c||!n)return toast('Select a case and enter the correction response.','error');const {error}=await sb.rpc('submit_qr_corrections',{p_case:c,p_note:n});if(error)return toast(error.message,'error');toast('Corrections submitted for reviewer re-review.');document.getElementById('qrCorrectionResponse').value='';loadQualityReviewQueue();}


// v2.10 Signature, Transmission & Delivery
let releaseRows=[];
async function loadReleaseQueue(){const {data,error}=await sb.from('release_transmission_queue').select('*').order('tax_year',{ascending:false});if(error)return toast(error.message,'error');releaseRows=data||[];const s=document.getElementById('releaseCase');if(s)s.innerHTML='<option value="">Select case</option>'+releaseRows.map(r=>`<option value="${r.case_id}">${esc(r.last_name)}, ${esc(r.first_name)} — ${r.tax_year} — ${esc(r.status)}</option>`).join('');const q=document.getElementById('releaseQueue');if(q)q.innerHTML=releaseRows.length?releaseRows.map(r=>`<div class="queue-row"><strong>${esc(r.last_name)}, ${esc(r.first_name)}</strong> · ${r.tax_year} <span class="badge">${esc(r.status)}</span><br><small>${esc(r.next_action||'')}</small><br><span class="muted">Signature: ${r.taxpayer_signature_complete?'Complete':'Pending'} · Payment release: ${r.payment_release_clear?'Clear':'Hold'} · Federal: ${esc(r.federal_status||'—')} · State: ${esc(r.state_status||'—')}</span></div>`).join(''):'<p class="muted">No cases in the release/transmission queue.</p>';}
function releaseRow(){return releaseRows.find(x=>x.case_id===document.getElementById('releaseCase').value)}
function selectReleaseCase(){const r=releaseRow(),d=document.getElementById('releaseSummary');if(!r){d.textContent='Select a case.';return}d.innerHTML=`<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong> · ${r.tax_year} · ${esc(r.status)}<br>${esc(r.next_action||'')}<br>Final balance: $${Number(r.final_balance||0).toFixed(2)} · Payment release: ${r.payment_release_clear?'Clear':'Hold'} · Signature: ${r.taxpayer_signature_complete?'Complete':'Pending'}`;document.getElementById('spouseSignatureRequired').checked=!!r.spouse_required;}
async function openSignatureStage(){const c=document.getElementById('releaseCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('open_signature_stage',{p_case:c,p_spouse_required:document.getElementById('spouseSignatureRequired').checked});if(error)return toast(error.message,'error');toast('Signature stage opened.');loadReleaseQueue();}
async function signPortalReturn(spouse){const c=document.getElementById('releaseCase').value,n=document.getElementById(spouse?'spouseSignatureName':'taxpayerSignatureName').value.trim();if(!c||!n)return toast('Select a case and enter the typed name.','error');const {error}=await sb.rpc('sign_return_authorization',{p_case:c,p_typed_name:n,p_is_spouse:spouse});if(error)return toast(error.message,'error');toast('Portal signature recorded.');loadReleaseQueue();}
async function syncFinalRelease(){const c=document.getElementById('releaseCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('sync_final_release',{p_case:c});if(error)return toast(error.message,'error');toast('Final release status synchronized.');loadReleaseQueue();}
async function recordTransmission(){const c=document.getElementById('releaseCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('record_transmission',{p_case:c,p_federal_status:'transmitted',p_state_status:document.getElementById('stateAck').value||null});if(error)return toast(error.message,'error');toast('Transmission recorded.');loadReleaseQueue();}
async function recordAcknowledgment(){const c=document.getElementById('releaseCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('record_acknowledgment',{p_case:c,p_federal_status:document.getElementById('federalAck').value,p_state_status:document.getElementById('stateAck').value||null});if(error)return toast(error.message,'error');toast('Acknowledgment recorded.');loadReleaseQueue();}
async function completeDelivery(){const c=document.getElementById('releaseCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('complete_return_delivery',{p_case:c});if(error)return toast(error.message,'error');toast('CT-010 — Return Delivery & Acceptance Record completed.');loadReleaseQueue();}


// v2.11 Commission, Archive & Post-Filing Follow-Up
let closeoutRows=[];
async function loadCloseoutQueue(){const {data,error}=await sb.from('closeout_management_queue').select('*').order('tax_year',{ascending:false});if(error)return toast(error.message,'error');closeoutRows=data||[];const s=document.getElementById('closeoutCase');if(s)s.innerHTML='<option value="">Select case</option>'+closeoutRows.map(r=>`<option value="${r.case_id}">${esc(r.last_name)}, ${esc(r.first_name)} — ${r.tax_year} — ${esc(r.status)}</option>`).join('');const q=document.getElementById('closeoutQueue');if(q)q.innerHTML=closeoutRows.length?closeoutRows.map(r=>`<div class="queue-row"><strong>${esc(r.last_name)}, ${esc(r.first_name)}</strong> · ${r.tax_year} <span class="badge">${esc(r.status)}</span><br><span class="muted">Collected: $${Number(r.practice_revenue_collected||0).toFixed(2)} · Eligible: $${Number(r.commission_eligible_revenue||0).toFixed(2)} · Commission: $${Number(r.commission_amount||0).toFixed(2)} · ${esc(r.commission_status||'pending')}</span><br><small>${esc(r.next_action||'')}</small></div>`).join(''):'<p class="muted">No cases in closeout.</p>';}
function closeoutRow(){return closeoutRows.find(x=>x.case_id===document.getElementById('closeoutCase').value)}
function selectCloseoutCase(){const r=closeoutRow(),d=document.getElementById('closeoutSummary');if(!r){d.textContent='Select a case.';return}d.innerHTML=`<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong> · ${r.tax_year} · ${esc(r.status)}<br>${esc(r.next_action||'')}<br>CT-010: ${r.ct010_complete?'Complete':'Pending'} · Commission: ${esc(r.commission_status||'pending')} · Follow-up: ${esc(r.follow_up_status||'none')}`;document.getElementById('eligibleRevenue').value=r.commission_eligible_revenue||'';document.getElementById('commissionRate').value=r.commission_rate||'';document.getElementById('followupDate').value=r.follow_up_date||'';document.getElementById('followupReason').value=r.follow_up_reason||'';}
async function prepareCommission(){const c=document.getElementById('closeoutCase').value,e=Number(document.getElementById('eligibleRevenue').value),r=Number(document.getElementById('commissionRate').value);if(!c||!Number.isFinite(e)||!Number.isFinite(r))return toast('Select a case and enter eligible revenue and commission rate.','error');const {error}=await sb.rpc('prepare_commission_control',{p_case:c,p_eligible_revenue:e,p_rate:r});if(error)return toast(error.message,'error');toast('PC-001 commission calculated.');loadCloseoutQueue();}
async function approveCommission(){const c=document.getElementById('closeoutCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('approve_commission',{p_case:c,p_note:document.getElementById('commissionNote').value||null});if(error)return toast(error.message,'error');toast('PC-001 approved.');loadCloseoutQueue();}
async function recordCommissionPaid(){const c=document.getElementById('closeoutCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('record_commission_paid',{p_case:c,p_reference:document.getElementById('commissionReference').value||null});if(error)return toast(error.message,'error');toast('PC-002 payout recorded.');loadCloseoutQueue();}
async function archiveCloseoutCase(){const c=document.getElementById('closeoutCase').value;if(!c)return toast('Select a case.','error');const d=document.getElementById('followupDate').value||null,n=document.getElementById('followupReason').value||null;const {error}=await sb.rpc('archive_case',{p_case:c,p_follow_up_date:d,p_follow_up_reason:n});if(error)return toast(error.message,'error');toast(d||n?'Post-filing follow-up scheduled.':'File archived.');loadCloseoutQueue();}
async function completeFollowup(){const c=document.getElementById('closeoutCase').value;if(!c)return toast('Select a case.','error');const {error}=await sb.rpc('complete_post_filing_followup',{p_case:c});if(error)return toast(error.message,'error');toast('Post-filing follow-up complete. File archived.');loadCloseoutQueue();}


// v2.12 Security & Account Linking
async function acceptStaffInvite(){const t=document.getElementById('inviteToken').value.trim();if(!t)return toast('Enter the invitation token.','error');const {error}=await sb.rpc('accept_firm_invitation',{p_token:t});if(error)return toast(error.message,'error');toast('Staff invitation accepted.');document.getElementById('inviteToken').value='';await loadPortalContext();}
async function acceptTaxpayerInvite(){const t=document.getElementById('inviteToken').value.trim();if(!t)return toast('Enter the invitation token.','error');const {error}=await sb.rpc('accept_taxpayer_invitation',{p_token:t});if(error)return toast(error.message,'error');toast('Taxpayer account linked.');document.getElementById('inviteToken').value='';await loadPortalContext();}
async function submitTaxpayerFormSecure(caseFormId,response){const {error}=await sb.rpc('submit_taxpayer_form',{p_case_form:caseFormId,p_response:response||{}});if(error)throw error;return true;}


// v2.14 Controlled Test Bootstrap
async function loadLaunchStatus(){const {data,error}=await sb.from('launch_readiness_status').select('*');if(error)return toast(error.message,'error');const firms=data||[],s=document.getElementById('testFirm');if(s)s.innerHTML=firms.map(f=>`<option value="${f.firm_id}">${esc(f.firm_name)}</option>`).join('');const d=document.getElementById('launchStatus');if(d)d.innerHTML=firms.length?firms.map(f=>`<div class="queue-row"><strong>${esc(f.firm_name)}</strong><br>Administrators: ${f.administrators} · Preparers: ${f.preparers} · Reviewers: ${f.reviewers} · Transmitters: ${f.transmitters} · EROs: ${f.eros} · Test/Live Cases: ${f.cases}</div>`).join(''):'<p class="muted">No firm exists yet. Sign in as the initial owner and use the existing firm-creation flow first.</p>';}
async function createTestStaffInvite(){const f=document.getElementById('testFirm').value,e=document.getElementById('testStaffEmail').value.trim(),r=document.getElementById('testStaffRole').value;if(!f||!e)return toast('Select a firm and enter the test account email.','error');const {data,error}=await sb.rpc('create_staff_invitation',{p_firm:f,p_email:e,p_role:r});if(error)return toast(error.message,'error');document.getElementById('staffInviteResult').innerHTML=`Invitation created for <strong>${esc(e)}</strong> as ${esc(r)}. Copy this one-time test token into Security & Linking after signing in as that test account:<br><code>${esc(data)}</code>`;toast('Test invitation created.');}


// v2.15 Firm Initialization & Lifecycle Test Harness
async function initializeFirstFirm(){const n=document.getElementById('initialFirmName').value.trim(),s=document.getElementById('initialFirmSlug').value.trim();if(!n)return toast('Enter the firm name.','error');const {data,error}=await sb.rpc('initialize_prodesk_firm',{p_name:n,p_slug:s||null});if(error)return toast(error.message,'error');toast('ProDesk firm initialized.');await loadPortalContext();await loadLifecycleTests();}
async function loadLifecycleTests(){const {data:firms,error:fe}=await sb.from('launch_readiness_status').select('*');if(fe)return toast(fe.message,'error');const fs=document.getElementById('lifecycleFirm');if(fs)fs.innerHTML=(firms||[]).map(f=>`<option value="${f.firm_id}">${esc(f.firm_name)}</option>`).join('');const {data,error}=await sb.from('lifecycle_test_dashboard').select('*').order('started_at',{ascending:false}).order('step_no');if(error)return toast(error.message,'error');const d=document.getElementById('lifecycleDashboard');if(!data?.length){d.innerHTML='<p class="muted">No lifecycle validation run exists yet.</p>';return}const rid=data[0].run_id,rows=data.filter(x=>x.run_id===rid);d.innerHTML=`<p><strong>${esc(rows[0].label)}</strong> <span class="badge">${esc(rows[0].run_status)}</span></p>`+rows.map(x=>`<div class="queue-row"><strong>${x.step_no}. ${esc(x.stage)}</strong> · ${esc(x.role||'system')} <span class="badge">${esc(x.step_status)}</span><br><small>${esc(x.expected_result)}</small><br><label>Actual result<input id="actual-${x.step_id}" value="${esc(x.actual_result||'')}"></label><div class="actions"><button class="btn secondary" onclick="recordLifecycleStep('${x.step_id}','pass')">PASS</button><button class="btn secondary" onclick="recordLifecycleStep('${x.step_id}','blocked')">BLOCKED</button><button class="btn secondary" onclick="recordLifecycleStep('${x.step_id}','fail')">FAIL</button></div></div>`).join('');}
async function createLifecycleRun(){const f=document.getElementById('lifecycleFirm').value,l=document.getElementById('lifecycleLabel').value.trim();if(!f)return toast('Initialize/select a firm first.','error');const {error}=await sb.rpc('create_lifecycle_test_run',{p_firm:f,p_label:l||'Controlled lifecycle test'});if(error)return toast(error.message,'error');toast('Lifecycle validation run started.');loadLifecycleTests();}
async function recordLifecycleStep(id,status){const a=document.getElementById('actual-'+id)?.value||null;const {error}=await sb.rpc('record_lifecycle_test_step',{p_step:id,p_status:status,p_actual_result:a});if(error)return toast(error.message,'error');toast('Test result recorded.');loadLifecycleTests();}
