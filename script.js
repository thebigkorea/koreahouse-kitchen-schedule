const API_URL = "https://script.google.com/macros/s/AKfycbwN4WtoaPahj-QCa0OwnSCIPBasRXEAtn1WFttHS2pjizj4KhSuxP5hGU6bfUTef-pb/exec";
const DAYS = ["월","화","수","목","금","토","일"];
const ROLE_LABELS = { kitchen:"주방", prep:"전처리", wash:"설거지" };
const ROLE_ORDER = ["kitchen","prep","wash"];
const ROW_COUNTS = { kitchen:8, prep:2, wash:4 };
let weeklyOptions = [], staff = [], dayOffs = {}, fullSchedule = emptySchedule_();

document.addEventListener("DOMContentLoaded", () => { document.getElementById("mondayInput").addEventListener("change", loadSelectedWeek); setThisWeek(); });
function getMonday(d){ d=new Date(d); const n=d.getDay(); d.setDate(d.getDate()+(n===0?-6:1-n)); d.setHours(0,0,0,0); return d; }
function fmt(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function setThisWeek(){ document.getElementById("mondayInput").value=fmt(getMonday(new Date())); loadSelectedWeek(false); }
function setNextWeek(){ const d=getMonday(new Date()); d.setDate(d.getDate()+7); document.getElementById("mondayInput").value=fmt(d); loadSelectedWeek(false); }
function loadThisWeek(){ setThisWeek(); }
function showLoading(v){ document.getElementById("loadingBox").classList.toggle("hidden",!v); }
function emptySchedule_(){ const s={}; for(let d=0;d<7;d++) s[d]={hall:[],kitchen:[],prep:[],exit:[],wash:[]}; return s; }
function esc(v){ return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

async function loadSelectedWeek(showMessage=true){
  const monday=document.getElementById("mondayInput").value; if(!monday) return;
  showLoading(true);
  try{
    const r=await fetch(`${API_URL}?action=getWeeklyScheduleBundle&monday=${encodeURIComponent(monday)}&t=${Date.now()}`,{cache:"no-store"});
    const result=await r.json(); if(!result.ok) throw new Error(result.message||"조회 실패");
    weeklyOptions=result.data.options||[];
    const saved=result.data.schedule||{}; fullSchedule=saved.found ? normalizeSchedule_(saved.schedule) : emptySchedule_();
    buildStaff_(); seedDaysOff_(); renderAll_(); applySchedule_(fullSchedule);
    if(showMessage) alert(saved.found?"저장된 주방·설거지 근무표를 불러왔습니다.":"저장된 근무표가 없어 새 근무표를 작성합니다.");
  }catch(e){ console.error(e); alert("근무표를 불러오지 못했습니다."); }
  finally{ showLoading(false); }
}
function normalizeSchedule_(src){ const out=emptySchedule_(); for(let d=0;d<7;d++) ROLE_ORDER.concat(["hall","exit"]).forEach(r=>out[d][r]=((src[d]||{})[r]||[])); return out; }
function buildStaff_(){
  const seen=new Set(); staff=[];
  ROLE_ORDER.forEach(role=>{
    weeklyOptions.forEach(day=>(day[role]||[]).forEach(name=>{ const key=role+"|"+name; if(!seen.has(key)){ seen.add(key); staff.push({name,role,target:role==="wash"?5:5}); } }));
  });
}
function seedDaysOff_(){ dayOffs={}; staff.forEach(s=>{ dayOffs[s.role+"|"+s.name]=weeklyOptions.map(d=>(d.dayOffNames||[]).includes(s.name)); }); }
function renderAll_(){ renderDayOffMatrix_(); renderRequired_(); renderSchedule_(); }
function renderDayOffMatrix_(){
  document.getElementById("dayOffHead").innerHTML=`<tr><th>구분</th><th>직원명</th>${weeklyOptions.map((d,i)=>`<th>${DAYS[i]}<small>${esc(d.label||"")}</small></th>`).join("")}<th>목표일수</th></tr>`;
  document.getElementById("dayOffBody").innerHTML=staff.map((s,i)=>`<tr><td><span class="role role-${s.role}">${ROLE_LABELS[s.role]}</span></td><td class="staff-name">${esc(s.name)}</td>${DAYS.map((_,d)=>`<td><button class="day-toggle ${dayOffs[s.role+'|'+s.name][d]?'off':''}" onclick="toggleDayOff(${i},${d},this)">${dayOffs[s.role+'|'+s.name][d]?'휴일':'근무 가능'}</button></td>`).join("")}<td><select onchange="staff[${i}].target=Number(this.value)">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${n===s.target?'selected':''}>주 ${n}일</option>`).join("")}</select></td></tr>`).join("") || `<tr><td colspan="11">등록된 주방·전처리·설거지 직원이 없습니다.</td></tr>`;
}
function toggleDayOff(i,d,btn){ const key=staff[i].role+"|"+staff[i].name; dayOffs[key][d]=!dayOffs[key][d]; btn.classList.toggle("off",dayOffs[key][d]); btn.textContent=dayOffs[key][d]?"휴일":"근무 가능"; }
function clearAllDaysOff(){ if(!confirm("선택한 휴일을 모두 취소할까요?")) return; Object.values(dayOffs).forEach(a=>a.fill(false)); renderDayOffMatrix_(); }
function renderRequired_(){ document.getElementById("requiredGrid").innerHTML=weeklyOptions.map((day,d)=>{ const kitchenNeed=d>=5?9:6; const washNeed=3; return `<div class="required-day"><strong>${DAYS[d]} <small>${esc(day.label||"")}</small></strong><label>주방 <input type="number" min="0" max="12" value="${kitchenNeed}" data-required="kitchen" data-day="${d}"></label><label>설거지 <input type="number" min="0" max="6" value="${washNeed}" data-required="wash" data-day="${d}"></label></div>`; }).join(""); }
function renderSchedule_(){
  document.getElementById("scheduleHead").innerHTML=`<tr><th>구분</th>${weeklyOptions.map((d,i)=>`<th>${DAYS[i]}<small>${esc(d.label||"")}</small></th><th>시간</th>`).join("")}</tr>`;
  let html="";
  ROLE_ORDER.forEach(role=>{ for(let row=0;row<ROW_COUNTS[role];row++){ html+=`<tr><td class="label role-${role}">${row===0?ROLE_LABELS[role]:ROLE_LABELS[role]+" "+(row+1)}</td>`; for(let d=0;d<7;d++){ html+=`<td>${nameSelect_(role,row,d)}</td><td>${timeSelect_(role,row,d)}</td>`; } html+="</tr>"; } });
  document.getElementById("scheduleBody").innerHTML=html; updateTitle_();
}
function nameSelect_(role,row,d){ const names=(weeklyOptions[d]||{})[role]||[]; return `<select class="name-select" data-role="${role}" data-row="${row}" data-day="${d}"><option value=""></option>${names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>`; }
function timeSelect_(role,row,d){ const times=(weeklyOptions[d]||{}).time||[]; return `<select class="time-select" data-role="${role}" data-row="${row}" data-day="${d}"><option value=""></option>${times.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>`; }
function updateTitle_(){ if(!weeklyOptions.length)return; document.getElementById("scheduleTitle").textContent=`주방·설거지 주간 근무표 (${weeklyOptions[0].label}~${weeklyOptions[6].label})`; }
function setSelect_(el,v){ if(!el)return; if(v&&!Array.from(el.options).some(o=>o.value===v)) el.add(new Option(v,v)); el.value=v||""; }
function applySchedule_(schedule){ for(let d=0;d<7;d++) ROLE_ORDER.forEach(role=>{ const items=(schedule[d]||{})[role]||[]; document.querySelectorAll(`.name-select[data-role="${role}"][data-day="${d}"]`).forEach((el,i)=>setSelect_(el,(items[i]||{}).name)); document.querySelectorAll(`.time-select[data-role="${role}"][data-day="${d}"]`).forEach((el,i)=>setSelect_(el,(items[i]||{}).time)); }); }

function autoArrange(){
  const assigned={}; staff.forEach(s=>assigned[s.role+"|"+s.name]=0); const warnings=[];
  for(let d=0;d<7;d++){
    const kitchenNeed=Number(document.querySelector(`[data-required="kitchen"][data-day="${d}"]`).value)||0;
    const washNeed=Number(document.querySelector(`[data-required="wash"][data-day="${d}"]`).value)||0;
    arrangeRole_("kitchen",d,kitchenNeed,assigned,warnings,true); arrangeRole_("wash",d,washNeed,assigned,warnings,false);
  }
  document.getElementById("warningText").textContent=warnings.length?`⚠️ ${warnings.join(" / ")}`:"휴일을 제외하여 자동편성했습니다.";
  document.querySelector(".table-card").scrollIntoView({behavior:"smooth"});
}
function arrangeRole_(role,d,need,assigned,warnings,includePrep){
  const roles=includePrep?["kitchen","prep"]:[role];
  const candidates=staff.filter(s=>roles.includes(s.role)&&!dayOffs[s.role+"|"+s.name][d]&&assigned[s.role+"|"+s.name]<s.target).sort((a,b)=>assigned[a.role+"|"+a.name]-assigned[b.role+"|"+b.name]||a.name.localeCompare(b.name,"ko"));
  const chosen=candidates.slice(0,need); if(chosen.length<need) warnings.push(`${DAYS[d]} ${role==="wash"?"설거지":"주방"} ${need-chosen.length}명 부족`);
  roles.forEach(r=>document.querySelectorAll(`.name-select[data-role="${r}"][data-day="${d}"]`).forEach(el=>el.value=""));
  chosen.forEach(s=>{ const empty=Array.from(document.querySelectorAll(`.name-select[data-role="${s.role}"][data-day="${d}"]`)).find(el=>!el.value); if(empty){ setSelect_(empty,s.name); assigned[s.role+"|"+s.name]++; const time=document.querySelector(`.time-select[data-role="${s.role}"][data-row="${empty.dataset.row}"][data-day="${d}"]`); if(time&&time.options.length>1) time.selectedIndex=1; } });
}
function collectKitchen_(){ const out={}; for(let d=0;d<7;d++){ out[d]={kitchen:[],prep:[],wash:[]}; ROLE_ORDER.forEach(role=>document.querySelectorAll(`.name-select[data-role="${role}"][data-day="${d}"]`).forEach(n=>{ const t=document.querySelector(`.time-select[data-role="${role}"][data-row="${n.dataset.row}"][data-day="${d}"]`); if(n.value||(t&&t.value)) out[d][role].push({name:n.value,time:t?t.value:""}); })); } return out; }
async function saveKitchenSchedule(){
  const monday=document.getElementById("mondayInput").value; if(!monday)return alert("주간 시작일을 선택하세요."); if(!confirm("주방·전처리·설거지 근무표를 저장할까요?\n기존 홀·퇴식 근무표는 그대로 유지됩니다."))return;
  const changed=collectKitchen_(), merged=normalizeSchedule_(fullSchedule); for(let d=0;d<7;d++) ROLE_ORDER.forEach(r=>merged[d][r]=changed[d][r]);
  showLoading(true); try{ const r=await fetch(API_URL,{method:"POST",body:JSON.stringify({action:"saveWeeklySchedule",monday,schedule:merged,dayOffs})}); const data=await r.json(); if(!data.ok)throw new Error(data.message||"저장 실패"); fullSchedule=merged; alert("주방·설거지 근무표와 선택한 휴일이 저장되었습니다."); }catch(e){console.error(e);alert("저장 중 오류가 발생했습니다.");}finally{showLoading(false);}
}
async function makeScheduleImage(){ if(typeof html2canvas!=="function")return alert("이미지 기능을 불러오지 못했습니다."); const card=document.querySelector(".table-card"); const canvas=await html2canvas(card,{scale:2,backgroundColor:"#ffffff",useCORS:true}); canvas.toBlob(async blob=>{ try{ await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]); alert("근무표 이미지를 복사했습니다. 카카오톡에 붙여넣으세요."); }catch(e){ const a=document.createElement("a"); a.download="한국의집-주방설거지-근무표.png"; a.href=canvas.toDataURL("image/png"); a.click(); } },"image/png"); }
