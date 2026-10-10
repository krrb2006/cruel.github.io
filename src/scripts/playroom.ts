const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stars = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-star]'));
const names = ['勇气','好奇','温柔','耐心','自由'];
stars.forEach((star,i) => star.onclick = () => {
  const on = star.getAttribute('aria-pressed') !== 'true'; star.setAttribute('aria-pressed',String(on)); star.textContent = on ? '✦' : '✧';
  const count = stars.filter(item => item.getAttribute('aria-pressed') === 'true').length;
  byId('star-status').textContent = names[i] + '星' + (on ? '已点亮' : '暂时休息') + ' · ' + count + ' / 5';
  byId('secret-letter').hidden = count !== 5;
});
byId('reset-stars').onclick = () => { stars.forEach(star => {star.setAttribute('aria-pressed','false');star.textContent='✧';});byId('secret-letter').hidden=true;byId('star-status').textContent='星空焕然一新。'; };
let remaining = 300, deadline = 0, running = false, interval: ReturnType<typeof setInterval> | undefined;
const minutes = byId<HTMLSelectElement>('focus-minutes');
function draw() { byId('focus-time').textContent = String(Math.floor(remaining / 60)).padStart(2,'0') + ':' + String(remaining % 60).padStart(2,'0'); }
function stop() { running=false;clearInterval(interval);interval=undefined;byId('focus-start').textContent='继续专注';minutes.disabled=false; }
function tick() {
  if (!running) return;
  remaining = Math.max(0,Math.ceil((deadline - Date.now()) / 1000));draw();
  if (remaining === 0) {stop();byId('focus-start').textContent='再开始一次';byId('focus-status').textContent='这一小段时间，已经认真地属于你。休息一下吧。';}
}
byId('focus-start').onclick = () => {
  if (running) {tick();stop();byId('focus-status').textContent='已暂停，按照自己的节奏来。';return;}
  if (!remaining) remaining=Number(minutes.value)*60;
  running=true;deadline=Date.now()+remaining*1000;minutes.disabled=true;byId('focus-start').textContent='暂停';byId('focus-status').textContent='正在专注。切换标签页也按实际时间计时；关闭页面会结束。';interval=setInterval(tick,500);draw();
};
function reset() {stop();remaining=Number(minutes.value)*60;draw();byId('focus-start').textContent='开始专注';byId('focus-status').textContent='新的小小开始。';}
minutes.onchange=reset;byId('focus-reset').onclick=reset;
document.addEventListener('visibilitychange',tick);window.addEventListener('pagehide',stop);
const KEY='flower-future-letter-v1', date=byId<HTMLInputElement>('capsule-date');
const localDate=()=>{const now=new Date();return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');};
date.min=localDate();
type Letter={text:string;date:string};
let letters:Letter[]=[];
function render() {
  const list=byId('capsule-list');list.replaceChildren();
  for (const letter of letters) {
    const box=document.createElement('details'),summary=document.createElement('summary');const unlocked=letter.date<=localDate();
    summary.textContent=letter.date+' · '+(unlocked?'可以拆开了':'尚未到约定的日子');box.append(summary);
    const content=document.createElement('p');content.textContent=unlocked?letter.text:'让时间替你保管这封信。日期限制只是小仪式，不是加密保护；你随时可以通过导出取回全文。';box.append(content);list.append(box);
  }
}
try {const raw=localStorage.getItem(KEY);if(raw){const value=JSON.parse(raw);if(!Array.isArray(value)||value.length>50||value.some(item=>typeof item.text!=='string'||item.text.length>2000||typeof item.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.date)))throw new Error();letters=value;}}
catch {byId('capsule-status').textContent='已有来信无法读取，原始数据未被覆盖。';byId<HTMLButtonElement>('capsule-form').querySelector<HTMLButtonElement>('button[type=submit]')!.disabled=true;}
render();
byId<HTMLFormElement>('capsule-form').onsubmit=event=>{
  event.preventDefault();const text=byId<HTMLTextAreaElement>('capsule-text').value.trim();
  if(!text||date.value<localDate()||letters.length>=50){byId('capsule-status').textContent='请填写文字与有效日期；最多保存 50 封。';return;}
  try {const next=[{text,date:date.value},...letters];localStorage.setItem(KEY,JSON.stringify(next));letters=next;render();byId<HTMLTextAreaElement>('capsule-text').value='';byId('capsule-status').textContent='已封存到当前浏览器。记得导出备份。';}
  catch {byId('capsule-status').textContent='无法保存，请检查浏览器存储权限。文字仍留在输入框。';}
};
byId('capsule-export').onclick=()=>{
  const blob=new Blob([JSON.stringify(letters,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='letters-to-my-future.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);byId('capsule-status').textContent='已请求下载备份，内含全部来信原文，请妥善保管。';
};
