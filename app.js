const $ = (id) => document.getElementById(id);
const STORAGE = 'card-study-v3-state';
const STATUS_KEY = 'card-study-v3-status';
const LOCAL_OVERRIDE_KEY = 'card-study-v3-overrides';

let repo = { owner: '', repo: '', branch: 'main', dir: '' };
let banks = [];
let activeBank = 'all';
let rawQuestions = [];
let questions = [];
let filtered = [];
let current = 0;
let showAnswer = false;
let statuses = JSON.parse(localStorage.getItem(STATUS_KEY) || '{}');
let overrides = JSON.parse(localStorage.getItem(LOCAL_OVERRIDE_KEY) || '{}');

const keywords = [
  'MyBatis','Spring MVC','Spring Boot','Spring','Bean','IoC','DI','AOP','JDBC','XML','Mapper','Dao','Controller','Service','POJO',
  '@RequestMapping','@RequestParam','@RequestBody','@ResponseBody','@RestController','@Autowired','@Component','@Service','@Repository',
  'DispatcherServlet','ModelAndView','三层架构','持久层','业务层','表示层','依赖注入','控制反转','动态 SQL','JSON'
];

function saveState(){ localStorage.setItem(STORAGE, JSON.stringify({ repo, activeBank })); }
function saveStatus(){ localStorage.setItem(STATUS_KEY, JSON.stringify(statuses)); }
function saveOverrides(){ localStorage.setItem(LOCAL_OVERRIDE_KEY, JSON.stringify(overrides)); }
function loadState(){
  const s = JSON.parse(localStorage.getItem(STORAGE) || '{}');
  repo = { ...repo, ...(s.repo || {}) };
  activeBank = s.activeBank || 'all';
  const detected = detectRepoFromPages();
  if (!repo.owner && detected.owner) repo = { ...repo, ...detected };
  $('ownerInput').value = repo.owner || '';
  $('repoInput').value = repo.repo || '';
  $('branchInput').value = repo.branch || 'main';
  $('dirInput').value = repo.dir || '';
}
function detectRepoFromPages(){
  const host = location.hostname;
  const parts = location.pathname.split('/').filter(Boolean);
  if (host.endsWith('.github.io') && parts[0]) {
    return { owner: host.replace('.github.io',''), repo: parts[0], branch: 'main', dir: '' };
  }
  return {};
}
function normalizeItem(item, idx, source){
  return {
    id: item.id ?? `${source}-${idx+1}`,
    type: item.type || '简答题',
    q: item.q || item.question || item.title || '',
    a: item.a || item.answer || '',
    desc: item.desc || item.analysis || item.explain || '',
    opts: item.opts || item.options || null,
    source
  };
}
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function highlight(str=''){
  let html = escapeHtml(str).replace(/\n/g,'<br>');
  for(const k of keywords.sort((a,b)=>b.length-a.length)){
    const safe = k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html = html.replace(new RegExp(safe,'gi'), m => `<mark class="key">${m}</mark>`);
  }
  return html;
}
function questionKey(q){ return `${q.source}::${q.id}`; }
function getStatus(q){ return statuses[questionKey(q)] || 'new'; }
function setStatus(value){
  const q = filtered[current]; if(!q) return;
  statuses[questionKey(q)] = value; saveStatus(); render();
}
function applyOverrides(list){
  return list.filter(q => !overrides[questionKey(q)]?.deleted).map(q => ({...q, ...(overrides[questionKey(q)]?.data || {})}));
}

async function refreshBanks(){
  repo = {
    owner: $('ownerInput').value.trim(), repo: $('repoInput').value.trim(),
    branch: $('branchInput').value.trim() || 'main', dir: $('dirInput').value.trim().replace(/^\/+|\/+$/g,'')
  };
  saveState();
  if(!repo.owner || !repo.repo){ alert('请先填写 GitHub 用户名和仓库名'); return; }
  const path = repo.dir ? `/contents/${encodeURIComponent(repo.dir)}` : '/contents';
  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}${path}?ref=${encodeURIComponent(repo.branch)}`;
  $('bankList').textContent = '正在读取 GitHub 仓库里的 JSON 文件……';
  $('bankList').className = 'bank-list empty';
  try{
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const files = await res.json();
    banks = files.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.json'))
      .map(f => ({ name: f.name, path: f.path, url: f.download_url, size: f.size }));
    renderBanks();
    if(banks.length){ await loadBank(activeBank === 'all' ? 'all' : (banks.find(b=>b.name===activeBank)?.name || banks[0].name)); }
  }catch(e){
    $('bankList').className = 'bank-list empty';
    $('bankList').innerHTML = `读取失败：${escapeHtml(e.message)}。确认仓库是 Public、分支正确、目录正确。`;
  }
}
function renderBanks(){
  $('bankCount').textContent = `${banks.length} 个`;
  const el = $('bankList'); el.className = 'bank-list'; el.innerHTML = '';
  if(!banks.length){ el.className='bank-list empty'; el.textContent='没有发现 .json 文件。把题库 JSON 上传到仓库根目录或指定目录后再刷新。'; return; }
  const all = document.createElement('button'); all.className = `bank-chip ${activeBank==='all'?'active':''}`; all.innerHTML = `全部合并 <small>${banks.length}</small>`; all.onclick=()=>loadBank('all'); el.appendChild(all);
  for(const b of banks){
    const btn = document.createElement('button'); btn.className = `bank-chip ${activeBank===b.name?'active':''}`; btn.innerHTML = `${escapeHtml(b.name)} <small>${Math.ceil(b.size/1024)}KB</small>`; btn.onclick=()=>loadBank(b.name); el.appendChild(btn);
  }
}
async function fetchJsonBank(bank){
  const url = `${bank.url}${bank.url.includes('?')?'&':'?'}t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`${bank.name} 读取失败`);
  const data = await res.json();
  if(!Array.isArray(data)) throw new Error(`${bank.name} 不是数组 JSON`);
  return data.map((x,i)=>normalizeItem(x,i,bank.name));
}
async function loadBank(name){
  activeBank = name; saveState(); renderBanks();
  try{
    if(name === 'all'){
      const arrays = await Promise.all(banks.map(fetchJsonBank));
      rawQuestions = arrays.flat();
    }else{
      const bank = banks.find(b=>b.name===name);
      if(!bank) return;
      rawQuestions = await fetchJsonBank(bank);
    }
    questions = applyOverrides(rawQuestions);
    current = 0; showAnswer = false; filterQuestions();
  }catch(e){ alert(e.message); }
}
function filterQuestions(){
  const kw = $('searchInput').value.trim().toLowerCase();
  const type = $('typeFilter').value;
  const status = $('statusFilter').value;
  filtered = questions.filter(q => {
    const typeOk = type === 'all' || q.type === type;
    const text = `${q.q} ${q.a} ${q.desc}`.toLowerCase();
    const kwOk = !kw || text.includes(kw);
    const statusOk = status === 'all' || getStatus(q) === status;
    return typeOk && kwOk && statusOk;
  });
  if(current >= filtered.length) current = Math.max(0, filtered.length-1);
  showAnswer = false; render();
}
function render(){
  const total = questions.length;
  $('totalCount').textContent = total;
  $('shortCount').textContent = questions.filter(q=>q.type==='简答题').length;
  $('masteredCount').textContent = questions.filter(q=>getStatus(q)==='mastered').length;
  $('reviewCount').textContent = questions.filter(q=>getStatus(q)==='review').length;
  $('listCount').textContent = `${filtered.length} 条`;
  const q = filtered[current];
  if(!q){
    $('typeBadge').textContent = '无题目'; $('progressText').textContent='0 / 0'; $('questionText').textContent='没有符合条件的题目'; $('answerBox').classList.add('hidden'); $('questionList').innerHTML=''; return;
  }
  $('typeBadge').textContent = q.type;
  $('progressText').textContent = `${current+1} / ${filtered.length}`;
  $('questionText').innerHTML = highlight(q.q);
  $('answerText').innerHTML = renderAnswer(q);
  $('descText').innerHTML = q.desc ? highlight(q.desc) : '';
  $('answerBox').classList.toggle('hidden', !showAnswer);
  $('showAnswerBtn').textContent = showAnswer ? '隐藏答案' : '显示答案';
  renderList();
}
function renderAnswer(q){
  if(q.type === '单选题' && q.opts){
    const opts = Object.entries(q.opts).map(([k,v])=>`<div><b>${k}.</b> ${highlight(v)}</div>`).join('');
    return `${opts}<hr><b>答案：</b>${highlight(q.a)}`;
  }
  if(q.type === '判断题') return `<b>答案：</b>${highlight(q.a)}`;
  return highlight(q.a || '暂无答案');
}
function renderList(){
  const list = $('questionList'); list.innerHTML = '';
  filtered.forEach((q,i)=>{
    const div = document.createElement('div'); div.className = `q-item ${i===current?'active':''}`;
    div.innerHTML = `<div class="q-item-title">${escapeHtml(q.q).slice(0,72)}${q.q.length>72?'…':''}</div><div class="q-item-meta"><span class="tag">${escapeHtml(q.type)}</span><span>${escapeHtml(q.source)}</span><span>${statusText(getStatus(q))}</span><div class="mini-actions"><button data-edit="${i}">改</button><button data-del="${i}">删</button></div></div>`;
    div.onclick = (e)=>{ if(e.target.dataset.edit || e.target.dataset.del) return; current=i; showAnswer=false; render(); };
    list.appendChild(div);
  });
  list.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>openEdit(filtered[Number(btn.dataset.edit)]));
  list.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>deleteQuestion(filtered[Number(btn.dataset.del)]));
}
function statusText(s){ return s==='mastered'?'已掌握':s==='review'?'待复习':'未标记'; }
function next(){ if(filtered.length){ current=(current+1)%filtered.length; showAnswer=false; render(); } }
function prev(){ if(filtered.length){ current=(current-1+filtered.length)%filtered.length; showAnswer=false; render(); } }
function random(){ if(filtered.length){ current=Math.floor(Math.random()*filtered.length); showAnswer=false; render(); } }

let editingKey = null;
function openEdit(q=null){
  editingKey = q ? questionKey(q) : null;
  $('dialogTitle').textContent = q ? '编辑题目' : '新增题目';
  $('editType').value = q?.type || '简答题'; $('editQ').value = q?.q || ''; $('editA').value = q?.a || ''; $('editDesc').value = q?.desc || '';
  $('editDialog').showModal();
}
function saveEdit(){
  const data = { type:$('editType').value.trim() || '简答题', q:$('editQ').value.trim(), a:$('editA').value.trim(), desc:$('editDesc').value.trim() };
  if(!data.q){ alert('题目不能为空'); return; }
  if(editingKey){ overrides[editingKey] = { ...(overrides[editingKey]||{}), data }; }
  else{
    const source = activeBank === 'all' ? 'local-new.json' : activeBank;
    const id = `local-${Date.now()}`;
    const q = { id, source, ...data };
    rawQuestions.push(q); overrides[questionKey(q)] = { data };
  }
  saveOverrides(); questions = applyOverrides(rawQuestions); filterQuestions(); $('editDialog').close();
}
function deleteQuestion(q){
  if(!q || !confirm('只会从当前浏览器本地隐藏/删除此题；要同步到 GitHub，请导出 JSON 后上传替换源文件。确定删除？')) return;
  overrides[questionKey(q)] = { ...(overrides[questionKey(q)]||{}), deleted:true };
  saveOverrides(); questions = applyOverrides(rawQuestions); filterQuestions();
}
function exportCurrent(){
  const data = questions.map(({source,...rest})=>rest);
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = activeBank==='all' ? 'merged_questions.json' : activeBank; a.click(); URL.revokeObjectURL(a.href);
}

function bind(){
  $('saveRepoBtn').onclick = refreshBanks; $('refreshBanksBtn').onclick = refreshBanks; $('mergeAllBtn').onclick=()=>loadBank('all'); $('exportBtn').onclick=exportCurrent;
  $('clearLocalBtn').onclick=()=>{ if(confirm('清空本地掌握/待复习/编辑/删除记录？不会影响 GitHub 文件。')){ localStorage.removeItem(STATUS_KEY); localStorage.removeItem(LOCAL_OVERRIDE_KEY); statuses={}; overrides={}; questions=applyOverrides(rawQuestions); filterQuestions(); }};
  $('searchInput').oninput = filterQuestions; $('typeFilter').onchange=filterQuestions; $('statusFilter').onchange=filterQuestions;
  $('showAnswerBtn').onclick=()=>{ showAnswer=!showAnswer; render(); }; $('masteredBtn').onclick=()=>setStatus('mastered'); $('reviewBtn').onclick=()=>setStatus('review'); $('prevBtn').onclick=prev; $('nextBtn').onclick=next; $('randomBtn').onclick=random;
  $('addBtn').onclick=()=>openEdit(); $('saveEditBtn').onclick=(e)=>{ e.preventDefault(); saveEdit(); }; $('cancelEditBtn').onclick=()=>$('editDialog').close();
  $('themeBtn').onclick=()=>{ const dark=document.documentElement.dataset.theme==='dark'; document.documentElement.dataset.theme=dark?'':'dark'; $('themeBtn').textContent=dark?'🌙':'☀️'; };
  document.addEventListener('keydown',e=>{ if(e.key==='ArrowRight')next(); if(e.key==='ArrowLeft')prev(); if(e.key===' ') {e.preventDefault(); showAnswer=!showAnswer; render();} });
}

loadState(); bind(); renderBanks();
if(repo.owner && repo.repo) refreshBanks();
