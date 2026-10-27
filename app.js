const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const STORE={users:'sai_users_v1',session:'sai_session_v1',students:'sai_students_v1',records:'sai_attendance_v1'};
const SCHOOL_PASSWORD='DASMESH09';
const classList=['Nursery','LKG','UKG',...Array.from({length:12},(_,i)=>`Class ${i+1}`)];
const sections=['A','B','C','D'];
let currentUser=null, cameraStream=null, activePage='dashboard', faceScanTimer=null, faceModelsReady=false, faceScanBusy=false, recognizedIds=new Set(), faceDescriptors=[];
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const dateLabel=(iso=todayISO())=>new Date(iso+'T12:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});
const read=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const students=()=>read(STORE.students);
const records=()=>read(STORE.records,{});
const getRecord=(id,date=todayISO())=>records()[date]?.[id]||'Absent';
function setRecord(id,status,date=todayISO()){let r=records();r[date]??={};r[date][id]=status;write(STORE.records,r)}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600)}
function classKey(c,s){return `${c}|${s}`}
function sortClass(a,b){let ai=classList.indexOf(a.className),bi=classList.indexOf(b.className);return ai-bi||a.section.localeCompare(b.section)||Number(a.rollNumber)-Number(b.rollNumber)}
function pct(s){let r=records(),days=Object.keys(r).sort(),present=days.filter(d=>r[d][s.id]==='Present').length;return days.length?Math.round(present/days.length*100):Number(s.initialPct??100)}
function orderedStudents(list=students()){return [...list].sort(sortClass)}
function fillClassSelect(el,includeAll=false){if(!el)return;el.innerHTML=(includeAll?'<option value="All">All Classes</option>':'<option value="">Select class</option>')+classList.map(c=>`<option>${c}</option>`).join('')}
function updateStreams(){const c=$('#studentClass')?.value,stream=$('#studentStream');if(!stream)return;stream.disabled=!['Class 11','Class 12'].includes(c);if(stream.disabled)stream.value=''}
function seed(){
  // Keep the demo account(s), but remove all built-in sample students and their sample attendance.
  // This also cleans up data saved by an earlier version of the project in this browser.
  const existing=read(STORE.students,[]);
  const sampleIds=new Set(existing.filter(s=>String(s.id).startsWith('seed')).map(s=>s.id));
  if(sampleIds.size){
    write(STORE.students,existing.filter(s=>!sampleIds.has(s.id)));
    const rec=records();
    Object.keys(rec).forEach(day=>{sampleIds.forEach(id=>delete rec[day][id]);if(!Object.keys(rec[day]).length)delete rec[day]});
    write(STORE.records,rec);
  }
  if(!localStorage.getItem(STORE.students))write(STORE.students,[]);
  if(!localStorage.getItem(STORE.records))write(STORE.records,{});
}
function showAuth(which='login'){ $('#authScreen').classList.remove('hidden');$('#app').classList.add('hidden');$('#loginForm').classList.toggle('hidden',which!=='login');$('#signupForm').classList.toggle('hidden',which!=='signup')}
function enterApp(user){currentUser=user;write(STORE.session,user);$('#authScreen').classList.add('hidden');$('#app').classList.remove('hidden');$('#todayDate').textContent=dateLabel();renderAll();goPage('dashboard')}
function logout(){localStorage.removeItem(STORE.session);currentUser=null;showAuth('login')}
$('#showSignup').onclick=()=>showAuth('signup');$('#showLogin').onclick=()=>showAuth('login');
$('#forgotBtn').onclick=()=>toast('For this demo, create a new account if you forget your password.');
$('#loginFormEl').onsubmit=e=>{e.preventDefault();let id=$('#loginIdentity').value.trim().toLowerCase(),pw=$('#loginPassword').value;let u=read(STORE.users,[]).find(x=>(x.email.toLowerCase()===id||x.name.toLowerCase()===id)&&x.password===pw);if(!u){toast('Account not found or password is incorrect.');return}enterApp({name:u.name,email:u.email})};
$('#signupFormEl').onsubmit=e=>{e.preventDefault();if($('#schoolPassword').value!==SCHOOL_PASSWORD){toast('Incorrect school password.');return}let users=read(STORE.users,[]),email=$('#signupEmail').value.trim().toLowerCase();if(users.some(u=>u.email.toLowerCase()===email)){toast('An account with this email already exists.');return}let u={name:$('#signupName').value.trim(),email,password:$('#signupPassword').value};users.push(u);write(STORE.users,users);toast('Account created. Please sign in.');$('#signupFormEl').reset();showAuth('login');$('#loginIdentity').value=email};
$('#logoutBtn').onclick=logout;$('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('mobile-open');
$('#reportsToggle').onclick=()=>$('#reportSubnav').classList.toggle('hidden');
$$('.nav-item[data-page]').forEach(b=>b.addEventListener('click',()=>{goPage(b.dataset.page);$('#sidebar').classList.remove('mobile-open')}));
function goPage(page){activePage=page;$$('.page').forEach(p=>p.classList.remove('active'));$('#page-'+page).classList.add('active');$$('.nav-item[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#reportSubnav').classList.toggle('hidden',!['daily','weekly','monthly'].includes(page));if(['daily','weekly','monthly'].includes(page))$('#reportsToggle').classList.add('active');else $('#reportsToggle').classList.toggle('active',page==='reports');renderPage(page)}
function renderAll(){['dashboard','attendance','students','daily','weekly','monthly','alerts'].forEach(renderPage)}
function header(title,sub,actions=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div>${actions}</div>`}
function stat(label,value,note,cls){return `<div class="stat-card ${cls}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`}
function pctStatus(v){return `<span class="status ${v<75?'absent':'present'}">${v}%</span>`}
function filters(report=false,monthly=false){return `<div class="filter-panel filters"><div class="filter-control"><label>Class</label><select id="filterClass">${classList.map(c=>`<option>${c}</option>`).join('')}<option value="All">All Classes</option></select></div><div class="filter-control"><label>Stream</label><select id="filterStream"><option value="All">All Streams</option><option>Science</option><option>Commerce</option><option>Humanities</option></select><div class="filter-help">For Classes 11 and 12</div></div><div class="filter-control"><label>Section</label><select id="filterSection"><option value="All">All Sections</option>${sections.map(s=>`<option>${s}</option>`).join('')}</select></div>${monthly?`<div class="filter-control"><label>Month</label><select id="filterMonth">${Array.from({length:12},(_,i)=>`<option value="${i}">${new Date(2026,i,1).toLocaleString('en',{month:'long'})}</option>`).join('')}</select></div>`:report?`<div class="filter-control"><label>Date</label><input id="filterDate" type="date" value="${todayISO()}"></div>`:''}<button class="primary go-button" id="applyFilters">Go →</button></div>`}
function filterList(){let c=$('#filterClass')?.value||'All',s=$('#filterSection')?.value||'All',st=$('#filterStream')?.value||'All';return orderedStudents().filter(x=>(c==='All'||x.className===c)&&(s==='All'||x.section===s)&&(st==='All'||x.stream===st||(!x.stream&&st==='All')))}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||''}</tbody></table></div>`}
function rowStudent(s,extra=''){return `<tr class="${pct(s)<75?'low-row':''}"><td>${esc(s.admissionNumber)}</td><td>${esc(s.rollNumber)}</td><td>${esc(s.name)}</td>${extra}</tr>`}
function renderDashboard(){let ss=students(),present=ss.filter(s=>getRecord(s.id)==='Present').length,abs=ss.length-present,rate=ss.length?Math.round(present/ss.length*100):0,classes=new Set(ss.map(s=>s.className)).size;$('#page-dashboard').innerHTML=`<div class="hero-card"><div><div>Good ${new Date().getHours()<12?'Morning':new Date().getHours()<17?'Afternoon':'Evening'},</div><h2>${esc(currentUser?.name||'Teacher')}</h2><p>Welcome to Smart Attend AI. Stay connected,<br>track attendance and manage your students easily.</p></div><div class="hero-brand">♟ Smart Attend <span>AI</span><p>Smarter Attendance | Brighter Future</p></div></div><div class="stats-grid">${stat('Total Students',ss.length,'Registered students','green')}${stat('Present Today',present,`${rate}% attendance rate`,'orange')}${stat('Absent Today',abs,`${100-rate}% absent rate`,'red')}${stat('Classes Today',classes,'Classes with students','blue')}</div><div class="dashboard-grid"><div class="panel"><div class="panel-title"><h3>📷 Mark Attendance</h3><button class="primary" id="dashMark">📷 Mark Attendance →</button></div><div class="donut-row"><div class="donut" style="--present-angle:${rate*3.6}deg"><div class="donut-center"><strong>${rate}%</strong>Present</div></div><div class="legend"><div><i class="dot" style="background:#2da665"></i>Present <strong>${present}</strong></div><div><i class="dot" style="background:#ff6262"></i>Absent <strong>${abs}</strong></div></div></div></div><div class="panel"><div class="panel-title"><h3>Today's Class-wise Attendance</h3></div>${table(['Class','Present','Absent','Rate'],classList.filter(c=>ss.some(s=>s.className===c)).map(c=>{let l=ss.filter(s=>s.className===c),p=l.filter(s=>getRecord(s.id)==='Present').length;return `<tr><td>${c}</td><td>${p}</td><td>${l.length-p}</td><td>${Math.round(p/l.length*100)}%</td></tr>`}).join(''))}</div></div>`;$('#dashMark').onclick=()=>goPage('attendance')}
function renderAttendance(){let list=filterListSafe();$('#page-attendance').innerHTML=`${header('Attendance Management','Select a class and section to view student attendance.')}<div class="filter-panel filters"><div class="filter-control"><label>Class</label><select id="attClass">${classList.map(c=>`<option>${c}</option>`).join('')}<option value="All">All Classes</option></select></div><div class="filter-control"><label>Stream</label><select id="attStream"><option value="All">All Streams</option><option>Science</option><option>Commerce</option><option>Humanities</option></select><div class="filter-help">Stream appears for Classes 11 and 12.</div></div><div class="filter-control"><label>Section</label><select id="attSection"><option value="All">All Sections</option>${sections.map(s=>`<option>${s}</option>`).join('')}</select></div><button class="primary go-button" id="attGo">Go →</button></div><div class="panel"><div class="attendance-toolbar"><div><h2>📷 Mark Attendance</h2><p>Open the camera or change attendance manually.</p></div><button class="primary" id="openCamera">📷 Mark Attendance →</button></div><div id="attTable"></div><div class="summary-strip" id="attSummary"></div></div>`;$('#attGo').onclick=renderAttTable;$('#attClass').onchange=()=>{};$('#openCamera').onclick=openCamera;renderAttTable()}
function filterListSafe(){return orderedStudents()}
function renderAttTable(){let c=$('#attClass')?.value||'All',s=$('#attSection')?.value||'All',st=$('#attStream')?.value||'All';let list=orderedStudents().filter(x=>(c==='All'||x.className===c)&&(s==='All'||x.section===s)&&(st==='All'||x.stream===st));let p=list.filter(x=>getRecord(x.id)==='Present').length;$('#attTable').innerHTML=list.length?table(['Admission Number','Roll Number','Student Name','Class','Section','Status'],list.map(x=>`<tr><td>${esc(x.admissionNumber)}</td><td>${esc(x.rollNumber)}</td><td>${esc(x.name)}</td><td>${x.className}</td><td>${x.section}</td><td><select class="status-select" data-id="${x.id}" aria-label="Attendance for ${esc(x.name)}"><option ${getRecord(x.id)==='Present'?'selected':''}>Present</option><option ${getRecord(x.id)==='Absent'?'selected':''}>Absent</option></select></td></tr>`).join('')):'<div class="empty-state">No students match these filters. Add students from the Students page.</div>';$('#attTable').querySelectorAll('.status-select').forEach(el=>el.onchange=()=>{setRecord(el.dataset.id,el.value);renderAttTable();renderDashboard()});$('#attSummary').innerHTML=`<span>👥 Total: <strong>${list.length}</strong></span><span>🟢 Present: <strong>${p}</strong></span><span>🔴 Absent: <strong>${list.length-p}</strong></span>`}
function renderStudents(){let ss=orderedStudents();$('#page-students').innerHTML=`${header('Students','View and manage student information, attendance and performance.',`<button class="primary" id="addStudentBtn">＋ Add Student</button>`)}<div class="filter-panel filters"><div class="filter-control"><label>Class</label><select id="filterClass">${classList.map(c=>`<option>${c}</option>`).join('')}<option value="All">All Classes</option></select></div><div class="filter-control"><label>Stream</label><select id="filterStream"><option value="All">All Streams</option><option>Science</option><option>Commerce</option><option>Humanities</option></select></div><div class="filter-control"><label>Section</label><select id="filterSection"><option value="All">All Sections</option>${sections.map(s=>`<option>${s}</option>`).join('')}</select></div><button class="primary go-button" id="studentGo">Go →</button></div><div class="panel"><div id="studentsTable"></div><div class="summary-strip" id="studentsSummary"></div></div>`;$('#addStudentBtn').onclick=openStudentModal;$('#studentGo').onclick=renderStudentTable;renderStudentTable()}
function renderStudentTable(){let list=filterList(),below=list.filter(s=>pct(s)<75).length;$('#studentsTable').innerHTML=list.length?table(['Admission Number','Roll Number','Student Name','Class','Section','Attendance %','Face Photo','Action'],list.map(s=>`<tr class="${pct(s)<75?'low-row':''}"><td>${esc(s.admissionNumber)}</td><td>${esc(s.rollNumber)}</td><td>${esc(s.name)}</td><td>${s.className}</td><td>${s.section}</td><td>${pctStatus(pct(s))}</td><td><button class="text-button register-face" data-id="${s.id}">${s.photo?'Replace photo':'Register face'}</button></td><td><button class="text-button delete-student" data-id="${s.id}">Remove</button></td></tr>`).join('')):'<div class="empty-state">No students found.</div>';$$('.register-face').forEach(b=>b.onclick=()=>registerFacePhoto(b.dataset.id));$('#studentsSummary').innerHTML=`<span>👥 Total Students: <strong>${list.length}</strong></span><span>🟢 Above 75%: <strong>${list.length-below}</strong></span><span>🔴 Below 75%: <strong>${below}</strong></span><span>Students below 75% are highlighted in red.</span>`;$$('.delete-student').forEach(b=>b.onclick=()=>{if(confirm('Remove this student and their attendance records?')){write(STORE.students,students().filter(s=>s.id!==b.dataset.id));let r=records();Object.values(r).forEach(day=>delete day[b.dataset.id]);write(STORE.records,r);renderAll();toast('Student removed')}})}
function openStudentModal(){$('#studentModal').classList.remove('hidden');$('#studentForm').reset();fillClassSelect($('#studentClass'));updateStreams()}
function closeStudent(){ $('#studentModal').classList.add('hidden')}
$('#closeStudentModal').onclick=closeStudent;$('#cancelStudent').onclick=closeStudent;$('#studentClass').onchange=updateStreams;
$('#studentForm').onsubmit=async e=>{e.preventDefault();let admission=$('#admissionNumber').value.trim();if(students().some(s=>s.admissionNumber.toLowerCase()===admission.toLowerCase())){toast('Admission number already exists.');return}let photoFile=$('#studentFacePhoto').files[0];if(!photoFile){toast('Please choose a clear face photo for AI recognition.');return}try{let photo=await compressImage(photoFile);let s={id:'stu'+Date.now(),name:$('#studentName').value.trim(),admissionNumber:admission,rollNumber:$('#rollNumber').value.trim(),className:$('#studentClass').value,stream:$('#studentStream').value,section:$('#studentSection').value,fatherPhone:$('#fatherPhone').value.trim(),photo,initialPct:100};write(STORE.students,[...students(),s]);closeStudent();renderAll();toast('Student added with face photo for AI recognition.')}catch(err){toast('Could not read the photo. Please try another image.')}};
function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const max=640,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',0.78))};img.src=reader.result};reader.readAsDataURL(file)})}
function registerFacePhoto(id){const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=async()=>{if(!input.files[0])return;try{const photo=await compressImage(input.files[0]);write(STORE.students,students().map(s=>s.id===id?{...s,photo}:s));renderStudentTable();toast('Face photo saved. This student can now be recognized by the camera.')}catch{toast('Could not read that image.')}};input.click()}
async function ensureFaceModels(){if(faceModelsReady)return;if(!window.faceapi)throw new Error('Face recognition library did not load. Check your internet connection and reload the page.');const base='https://justadudewhohacks.github.io/face-api.js/models';await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(base),faceapi.nets.faceLandmark68Net.loadFromUri(base),faceapi.nets.faceRecognitionNet.loadFromUri(base)]);faceModelsReady=true}
async function makeReferenceDescriptors(){const list=orderedStudents().filter(s=>s.photo);const refs=[];for(const s of list){try{const img=await faceapi.fetchImage(s.photo);const result=await faceapi.detectSingleFace(img,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:0.45})).withFaceLandmarks().withFaceDescriptor();if(result)refs.push({id:s.id,name:s.name,descriptor:result.descriptor});}catch(e){console.warn('Could not process face photo for',s.name,e)}}return refs}
async function openCamera(){recognizedIds=new Set();faceDescriptors=[];$('#cameraDone').disabled=true;$('#cameraMatches').innerHTML='';$('#cameraModal').classList.remove('hidden');$('#cameraMessage').textContent='Loading AI face-recognition models…';try{await ensureFaceModels();faceDescriptors=await makeReferenceDescriptors();if(!faceDescriptors.length){$('#cameraMessage').textContent='No usable face photos found. Open Students → Register face for each student, using a clear front-facing photo, then try again.';return}const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});cameraStream=stream;$('#cameraVideo').srcObject=stream;await $('#cameraVideo').play();$('#cameraMessage').textContent=`AI ready. ${faceDescriptors.length} face photo(s) enrolled. Looking for known students…`;$('#cameraDone').disabled=false;faceScanTimer=setInterval(scanCameraFrame,850)}catch(err){$('#cameraMessage').textContent=err.message||'Camera unavailable or permission denied. Run on localhost/HTTPS and allow camera access.'}}
async function drawFaceBoxes(detections) {
    const video = $('#cameraVideo');
    const canvas = $('#faceOverlay');

    if (!video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const det of detections) {
        const box = det.detection.box;
        let best = null;
        let bestDistance = Infinity;

        for (const ref of faceDescriptors) {
            const distance = faceapi.euclideanDistance(
                det.descriptor,
                ref.descriptor
            );

            if (distance < bestDistance) {
                bestDistance = distance;
                best = ref;
            }
        }

        const matched = best && bestDistance < 0.48;
        const student = matched
            ? students().find(s => s.id === best.id)
            : null;

        ctx.strokeStyle = matched ? '#42d392' : '#ff6262';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const label = student
            ? `${student.name} (${student.admissionNumber})`
            : 'Unknown Student';

        ctx.font = 'bold 15px Arial';

        const labelWidth = ctx.measureText(label).width + 16;
        const labelY = Math.max(0, box.y - 30);

        ctx.fillStyle = matched ? '#176b45' : '#9b3030';
        ctx.fillRect(box.x, labelY, labelWidth, 26);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, box.x + 8, labelY + 18);
    }
}
scanCameraFrame(){if(faceScanBusy||!cameraStream||!faceModelsReady)return;const video=$('#cameraVideo');if(video.readyState<2)return;faceScanBusy=true;try{const detections=await faceapi.detectAllFaces(video,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:0.5})).withFaceLandmarks().withFaceDescriptors();for(const det of detections){let best=null,bestDistance=Infinity;for (const ref of faceDescriptors) drawFaceBoxes(detections);{
    // Don't match a new face to a student already marked present
    // during this camera session.
    if (recognizedIds.has(ref.id)) continue;

    const dist = faceapi.euclideanDistance(
        det.descriptor,
        ref.descriptor
    );

    if (dist < bestDistance) {
        bestDistance = dist;
        best = ref;
    }
}if(best&&bestDistance<0.48&&!recognizedIds.has(best.id)){recognizedIds.add(best.id);setRecord(best.id,'Present');const st=students().find(s=>s.id===best.id);$('#cameraMatches').insertAdjacentHTML('afterbegin',`<div class="face-match">✅ <strong>${esc(best.name)}</strong> marked Present <small>${esc(st?.admissionNumber||'')}</small></div>`);$('#cameraMessage').textContent=`Recognized ${recognizedIds.size} student(s). Keep scanning to detect more faces.`;renderDashboard();if(activePage==='attendance')renderAttTable()}}if(!detections.length&&$('#cameraMessage').textContent.startsWith('Recognized'))$('#cameraMessage').textContent=`Recognized ${recognizedIds.size} student(s). No face currently detected.`}catch(err){console.warn('Face scan issue',err)}finally{faceScanBusy=false}}
function closeCamera(){if(faceScanTimer)clearInterval(faceScanTimer);faceScanTimer=null;$('#cameraDone').disabled=true;if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;$('#cameraVideo').srcObject=null;$('#cameraModal').classList.add('hidden')}
$('#closeCamera').onclick=closeCamera;$('#stopCamera').onclick=closeCamera;$('#cameraDone').onclick=()=>{const c=$('#attClass')?.value||'All',sec=$('#attSection')?.value||'All',st=$('#attStream')?.value||'All';const eligible=orderedStudents().filter(x=>(c==='All'||x.className===c)&&(sec==='All'||x.section===sec)&&(st==='All'||x.stream===st));eligible.forEach(x=>setRecord(x.id,recognizedIds.has(x.id)?'Present':'Absent'));closeCamera();renderAll();goPage('attendance');toast(`Camera session complete: ${recognizedIds.size} recognized as present; remaining filtered students marked absent.`)};
function renderReport(type){let title=type[0].toUpperCase()+type.slice(1),isMonthly=type==='monthly',isWeekly=type==='weekly';let actions=`<div class="report-actions"><button class="secondary" id="printReport">▣ Print</button><button class="secondary" id="exportReport">▦ Export to Excel (CSV)</button><button class="primary" id="downloadReport">↓ Download CSV</button></div>`;$('#page-'+type).innerHTML=`${header(`${title} Attendance Report`,`View and download the ${type} attendance report.`,actions)}${filters(true,isMonthly)}<div class="report-period" id="reportPeriod"></div><div class="panel"><div id="reportTable"></div><div class="summary-strip" id="reportSummary"></div></div>`;if(isWeekly){$('.filters', $('#page-weekly'))?.querySelector('#filterDate')?.closest('.filter-control')?.remove()}if(!isWeekly&&!isMonthly&&$('#filterDate')){}if(isMonthly){let m=$('#filterMonth');if(m)m.value=String(new Date().getMonth())}$('#applyFilters').onclick=()=>renderReportTable(type);$('#printReport').onclick=()=>window.print();$('#exportReport').onclick=()=>exportCSV(type);$('#downloadReport').onclick=()=>exportCSV(type);renderReportTable(type)}
function reportDates(type){let now=new Date(),out=[];if(type==='daily')return [$('#filterDate')?.value||todayISO()];if(type==='monthly'){let month=Number($('#filterMonth')?.value??now.getMonth()),year=now.getFullYear();for(let d=1;d<=new Date(year,month+1,0).getDate();d++){let dt=new Date(year,month,d);if(dt<=now)out.push(`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)}return out}let day=now.getDay(),diff=(day+6)%7,start=new Date(now);start.setDate(now.getDate()-diff);for(let i=0;i<7;i++){let dt=new Date(start);dt.setDate(start.getDate()+i);if(dt<=now)out.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`)}return out}
function renderReportTable(type){let c=$('#filterClass')?.value||'All',sec=$('#filterSection')?.value||'All',st=$('#filterStream')?.value||'All';let list=orderedStudents().filter(x=>(c==='All'||x.className===c)&&(sec==='All'||x.section===sec)&&(st==='All'||x.stream===st));let dates=reportDates(type),presentCount=0,absentCount=0;let period=type==='daily'?`Date: ${dateLabel(dates[0])}`:type==='monthly'?`Month: ${new Date(Number(dates[0]?.slice(0,4)||new Date().getFullYear()),Number($('#filterMonth')?.value||0),1).toLocaleString('en',{month:'long',year:'numeric'})}`:`Current week: ${dates.length?dateLabel(dates[0])+' – '+dateLabel(dates[dates.length-1]):'No dates'}`;$('#reportPeriod').textContent=period;let heads=['Admission Number','Roll Number','Student Name','Class','Section'],rows='';if(type==='daily'){heads.push('Attendance Status');rows=list.map(s=>{let status=getRecord(s.id,dates[0]);if(records()[dates[0]]?.[s.id]===undefined)status='Not marked';if(status==='Present')presentCount++;else if(status==='Absent')absentCount++;return `<tr><td>${esc(s.admissionNumber)}</td><td>${esc(s.rollNumber)}</td><td>${esc(s.name)}</td><td>${s.className}</td><td>${s.section}</td><td><span class="status ${status==='Present'?'present':status==='Absent'?'absent':''}">${status}</span></td></tr>`}).join('')}else if(type==='weekly'){dates.forEach(d=>heads.push(new Date(d+'T12:00:00').toLocaleDateString('en',{weekday:'short',day:'2-digit'})));heads.push('Weekly Attendance');rows=list.map(s=>{let p=0,n=0;let cells=dates.map(d=>{let v=records()[d]?.[s.id];if(v==='Present'){p++;presentCount++}else if(v==='Absent'){n++;absentCount++}return `<td><span class="status ${v==='Present'?'present':v==='Absent'?'absent':''}">${v==='Present'?'P':v==='Absent'?'A':'—'}</span></td>`}).join('');return `<tr><td>${esc(s.admissionNumber)}</td><td>${esc(s.rollNumber)}</td><td>${esc(s.name)}</td><td>${s.className}</td><td>${s.section}</td>${cells}<td>${p+n?Math.round(p/(p+n)*100)+'%':'—'}</td></tr>`}).join('')}else{heads.push('Days Present','Days Absent','Working Days','Monthly Attendance');rows=list.map(s=>{let p=0,n=0;dates.forEach(d=>{let v=records()[d]?.[s.id];if(v==='Present'){p++;presentCount++}else if(v==='Absent'){n++;absentCount++}});let total=p+n,percent=total?Math.round(p/total*100):0;return `<tr class="${total&&percent<75?'low-row':''}"><td>${esc(s.admissionNumber)}</td><td>${esc(s.rollNumber)}</td><td>${esc(s.name)}</td><td>${s.className}</td><td>${s.section}</td><td>${p}</td><td>${n}</td><td>${total}</td><td>${total?pctStatus(percent):'—'}</td></tr>`}).join('')}$('#reportTable').innerHTML=list.length?table(heads,rows):'<div class="empty-state">No students match these filters.</div>';let total=presentCount+absentCount;$('#reportSummary').innerHTML=`<span>👥 Total Students: <strong>${list.length}</strong></span><span>🟢 Present: <strong>${presentCount}</strong></span><span>🔴 Absent: <strong>${absentCount}</strong></span><span>Attendance records: <strong>${total}</strong></span>`}
function exportCSV(type){let c=$('#filterClass')?.value||'All',sec=$('#filterSection')?.value||'All',st=$('#filterStream')?.value||'All';let list=orderedStudents().filter(x=>(c==='All'||x.className===c)&&(sec==='All'||x.section===sec)&&(st==='All'||x.stream===st));let dates=reportDates(type),headers=['Admission Number','Roll Number','Student Name','Class','Section'];if(type==='daily')headers.push('Date','Attendance Status');else if(type==='weekly'){dates.forEach(d=>headers.push(dateLabel(d)));headers.push('Weekly Attendance')}else headers.push('Days Present','Days Absent','Working Days','Monthly Attendance');let data=[headers];list.forEach(s=>{let row=[s.admissionNumber,s.rollNumber,s.name,s.className,s.section];if(type==='daily')row.push(dates[0],records()[dates[0]]?.[s.id]||'Not marked');else{let p=0,n=0;dates.forEach(d=>{let v=records()[d]?.[s.id];if(v==='Present')p++;if(v==='Absent')n++;if(type==='weekly')row.push(v||'Not marked')});if(type==='weekly')row.push(p+n?Math.round(p/(p+n)*100)+'%':'—');else row.push(p,n,p+n,p+n?Math.round(p/(p+n)*100)+'%':'—')}data.push(row)});let csv=data.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');let blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`smart-attend-${type}-${todayISO()}.csv`;a.click();URL.revokeObjectURL(url);toast('CSV report downloaded.')}
function renderAlerts(){let list=orderedStudents().filter(s=>pct(s)<75);let grouped={};list.forEach(s=>(grouped[classKey(s.className,s.section)]??=[]).push(s));$('#page-alerts').innerHTML=`<div class="alert-head">${header('Attendance Alerts','List of students with less than 75% attendance.')}<div class="alert-count">⚠ Total Students Below 75%<strong>${list.length}</strong></div></div><div class="filter-panel filters"><div class="filter-control"><label>Class View</label><select id="alertClass"><option value="All">All Classes</option>${classList.map(c=>`<option>${c}</option>`).join('')}</select></div><div class="filter-control" style="grid-column:span 2"><label>Search students</label><input id="alertSearch" class="search-input" placeholder="Search by student name or admission number..."></div></div><div id="alertGroups"></div>`;$('#alertClass').onchange=renderAlertGroups;$('#alertSearch').oninput=renderAlertGroups;renderAlertGroups()}
function renderAlertGroups(){let c=$('#alertClass')?.value||'All',q=($('#alertSearch')?.value||'').toLowerCase();let list=orderedStudents().filter(s=>pct(s)<75&&(c==='All'||s.className===c)&&(`${s.name} ${s.admissionNumber} ${s.rollNumber}`.toLowerCase().includes(q)));let groups={};list.forEach(s=>(groups[classKey(s.className,s.section)]??=[]).push(s));$('#alertGroups').innerHTML=Object.keys(groups).length?Object.keys(groups).sort((a,b)=>{let [ac,as]=a.split('|'),[bc,bs]=b.split('|');return classList.indexOf(ac)-classList.indexOf(bc)||as.localeCompare(bs)}).map(k=>{let [cl,se]=k.split('|');return `<div class="class-group"><button class="class-group-head"><span>♟ ${cl} ${se} <small>· ${groups[k].length} student${groups[k].length===1?'':'s'}</small></span><span>⌄</span></button><div class="class-group-body">${table(['Admission Number','Roll Number','Student Name','Class','Section','Attendance %'],groups[k].map(s=>`<tr class="low-row"><td>${esc(s.admissionNumber)}</td><td>${esc(s.rollNumber)}</td><td>${esc(s.name)}</td><td>${s.className}</td><td>${s.section}</td><td>${pctStatus(pct(s))}</td></tr>`).join(''))}</div></div>`}).join(''):'<div class="panel empty-state">🎉 No students below 75% attendance match your search.</div>';$$('.class-group-head').forEach(b=>b.onclick=()=>b.parentElement.classList.toggle('open'))}
function renderPage(page){if(page==='dashboard')renderDashboard();if(page==='attendance')renderAttendance();if(page==='students')renderStudents();if(['daily','weekly','monthly'].includes(page))renderReport(page);if(page==='alerts')renderAlerts()}
seed();fillClassSelect($('#studentClass'));$('#studentClass').onchange=updateStreams;
// Always show the login page when the site is opened or refreshed. Keep saved accounts and student data, but do not silently bypass sign-in.
seed();
fillClassSelect($('#studentClass'));
$('#studentClass').onchange = updateStreams;

// Restore the previous login session when the website reopens.
const savedSession = read(STORE.session, null);

if (savedSession && savedSession.email && savedSession.name) {
    currentUser = savedSession;
    $('#authScreen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#todayDate').textContent = dateLabel();
    renderAll();
    goPage('dashboard');
} else {
    currentUser = null;
    showAuth('login');
}
