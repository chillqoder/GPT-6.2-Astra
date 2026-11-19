/* A local mesh renderer for the RX–01. Coordinates are shared by the WebGL
   renderer and the depth-sorted canvas renderer used on software-only devices.
   The model follows the studio photograph: brushed case, printed faceplate,
   rubber corner guards, bridge handle, telescoping aerial and a coiled lead. */
window.createReceiver = function createReceiver(canvas, range, onTune, getScope, setScope) {
  const TAU = Math.PI * 2;
  // Camera distance, framing offsets (up, and left to leave room for the lead) and the tilt the photograph sits at.
  const D = 6.4, LIFT = .34, SLIDE = .3, ROLL = .14, FIT_W = 5.6, FIT_H = 4.9;
  const KNOB_X = 1.18, KNOBS = [["tune",.40],["scope",-.44]], KEYS = [-.93,-.61,-.29,.03,.35];
  const SCREEN = {x:-.47, y:.085};
  // A full turn of either dial runs from seven o'clock round to five o'clock.
  const SWEEP_FROM = 3.93, SWEEP = 4.71;
  let gl = canvas.getContext("webgl",{alpha:true,antialias:true,preserveDrawingBuffer:false});
  const lite = !gl;
  const faces = [];
  /* The fourth value picks the surface model in the fragment shader:
     0 matte · 1 brushed metal · 2 printed faceplate · 3 gloss plastic · 4 emissive · 5 chrome · 6 glass */
  const palette = {
    shell:[.69,.70,.65,1], metal:[.76,.77,.71,1], plate:[.77,.78,.72,2],
    black:[.08,.085,.075,0], rubber:[.14,.145,.13,0], white:[.95,.95,.9,0],
    orange:[1,.34,.09,3], shine:[.86,.87,.82,5], screen:[.03,.05,.022,6],
    grid:[.17,.29,.07,4], axis:[.27,.44,.09,4], haze:[.10,.19,.03,4], glow:[.36,.60,.07,4], trace:[.82,1,.2,4], led:[1,.33,.12,4]
  };
  const sub = (a,b) => a.map((v,i) => v-b[i]);
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => {const length = Math.hypot(...a)||1;return a.map(v=>v/length);};
  function face(points, material, list = faces, normals) {
    const [r,g,b,kind] = palette[material];
    list.push({points,normals,normal:unit(cross(sub(points[1],points[0]),sub(points[2],points[0]))),color:[r,g,b],kind});
  }
  function slab(x,y,z,w,h,d,cut,material,front=material) {
    const a=w/2,b=h/2,c=cut;
    const perimeter=[[-a+c,-b],[a-c,-b],[a,-b+c],[a,b-c],[a-c,b],[-a+c,b],[-a,b-c],[-a,-b+c]];
    const near=perimeter.map(([u,v])=>[x+u,y+v,z+d/2]);
    const far=perimeter.map(([u,v])=>[x+u,y+v,z-d/2]);
    face(near,front);face([...far].reverse(),material);
    for(let i=0;i<8;i++){const j=(i+1)%8;face([far[i],far[j],near[j],near[i]],material);}
  }
  // A cylinder or cone. Round parts carry per-vertex normals so they shade smoothly; knurled ones stay faceted.
  function rod(start,end,radius,material,sides=12,fluted=false,endRadius=radius) {
    const axis=unit(sub(end,start));
    const u=unit(cross(Math.abs(axis[1])>.85?[1,0,0]:[0,1,0],axis)),v=cross(axis,u);
    const spoke=i=>{const t=TAU*i/sides;return u.map((c,k)=>Math.cos(t)*c+Math.sin(t)*v[k]);};
    const ring=(center,r)=>Array.from({length:sides},(_,i)=>{const n=spoke(i),size=r*(fluted&&i%2?.9:1);return center.map((c,k)=>c+size*n[k]);});
    const a=ring(start,radius),b=ring(end,endRadius);
    face([...a].reverse(),material);face(b,material);
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides;
      face([a[i],a[j],b[j],b[i]],material,faces,fluted?undefined:[spoke(i),spoke(j),spoke(j),spoke(i)]);
    }
  }
  // A smooth hose swept along a path, used for the lead.
  function tube(path,radius,material,sides) {
    const rings=[];let u;
    path.forEach((point,i)=>{
      const t=unit(sub(path[Math.min(i+1,path.length-1)],path[Math.max(i-1,0)]));
      u=u?unit(sub(u,t.map(c=>c*dot(u,t)))):unit(cross(Math.abs(t[1])>.85?[1,0,0]:[0,1,0],t));
      const v=cross(t,u);
      rings.push(Array.from({length:sides},(_,k)=>{
        const a=TAU*k/sides,n=u.map((c,j)=>Math.cos(a)*c+Math.sin(a)*v[j]);
        return {n,p:point.map((c,j)=>c+radius*n[j])};
      }));
    });
    for(let i=1;i<rings.length;i++)for(let k=0;k<sides;k++){
      const a=rings[i-1],b=rings[i],j=(k+1)%sides;
      face([a[k].p,a[j].p,b[j].p,b[k].p],material,faces,[a[k].n,a[j].n,b[j].n,b[k].n]);
    }
    face(rings[0].map(r=>r.p).reverse(),material);face(rings[rings.length-1].map(r=>r.p),material);
  }
  // A thin printed stroke lying on a plane that faces the viewer.
  function mark(x,y,z,angle,half,width,material,list=faces) {
    const c=Math.cos(angle),s=Math.sin(angle);
    face([[x-c*half+s*width,y-s*half-c*width,z],[x+c*half+s*width,y+s*half-c*width,z],[x+c*half-s*width,y+s*half+c*width,z],[x-c*half-s*width,y-s*half+c*width,z]],material,list);
  }
  function screw(x,y,z,radius=.045) {
    rod([x,y,z-.03],[x,y,z+.012],radius,"shine",12);
    for(const turn of [.5,.5+Math.PI/2])mark(x,y,z+.0135,turn,radius*.62,radius*.13,"black");
  }

  // Case: rear shell, gasket and the printed faceplate.
  slab(0,0,0,3.9,2.28,1.26,.14,"shell");
  slab(0,0,.6,3.94,2.3,.07,.14,"black");
  slab(0,0,.69,3.81,2.18,.12,.10,"metal","plate");
  // Rubber guards cap all eight corners; the front four carry a screw.
  for(const sx of [-1,1])for(const sy of [-1,1]){
    slab(sx*1.80,sy*1.0,.56,.40,.36,.52,.10,"rubber");
    slab(sx*1.80,sy*1.0,-.50,.40,.36,.34,.10,"rubber");
    screw(sx*1.80,sy*1.0,.82,.05);
  }
  // Scope: bezel, glass and the graticule.
  slab(SCREEN.x,SCREEN.y,.777,2.32,1.50,.105,.10,"black");
  slab(SCREEN.x,SCREEN.y,.834,2.04,1.22,.03,.06,"screen");
  for(const sx of [-1,1])for(const sy of [-1,1])screw(SCREEN.x+sx*1.075,SCREEN.y+sy*.665,.8295,.03);
  const gridZ=.853;
  for(let i=0;i<=10;i++)mark(SCREEN.x-.95+i*.19,SCREEN.y,gridZ,Math.PI/2,.56,i===5?.0045:.003,i===5?"axis":"grid");
  for(let i=0;i<=8;i++)mark(SCREEN.x,SCREEN.y-.56+i*.14,gridZ,0,.95,i===4?.0045:.003,i===4?"axis":"grid");
  for(let i=1;i<50;i++)if(i%5)mark(SCREEN.x-.95+i*.038,SCREEN.y,gridZ,Math.PI/2,.014,.003,"axis");
  for(let i=1;i<40;i++)if(i%5)mark(SCREEN.x,SCREEN.y-.56+i*.028,gridZ,0,.014,.003,"axis");
  // Power jack, pilot lamp and the five orange keys.
  rod([-1.47,-.875,.74],[-1.47,-.875,.775],.085,"shine",20);
  rod([-1.47,-.875,.74],[-1.47,-.875,.781],.055,"black",16);
  rod([-1.27,-.905,.74],[-1.27,-.905,.772],.028,"led",10);
  for(const x of KEYS){
    slab(x,-.875,.755,.275,.145,.03,.02,"black");
    slab(x,-.875,.79,.25,.12,.12,.02,"orange");
  }
  // Dials: a black scale ring with white graduations under a knurled cone and a cap.
  for(const [id,y] of KNOBS){
    rod([KNOB_X,y,.74],[KNOB_X,y,.762],.40,"black",48);
    for(let i=0;i<=20;i++){
      const a=SWEEP_FROM-i/20*SWEEP,long=i%5===0,r=long?.365:.372;
      mark(KNOB_X+Math.cos(a)*r,y+Math.sin(a)*r,.7635,a,long?.027:.02,long?.007:.0045,"white");
    }
    rod([KNOB_X,y,.762],[KNOB_X,y,.905],.33,"rubber",44,true,.282);
    rod([KNOB_X,y,.905],[KNOB_X,y,.94],.266,id==="tune"?"orange":"black",40,false,.25);
  }
  for(const [x,y] of [[.79,.82],[1.55,.82],[.79,-.01],[1.55,-.01],[.79,-.84],[1.55,-.84]])screw(x,y,.75,.026);
  // Side vents on both flanks.
  for(const side of [-1,1])for(let i=0;i<7;i++)slab(side*1.955,.62-i*.17,-.02,.022,.085,.62,.006,"black");
  // Bridge handle: a splayed arch with rounded shoulders on two bolted feet.
  function arch(foot,shoulder,top,round) {
    const points=[[-foot,1.1]],lean=unit([shoulder-foot,1.1-top,0]);
    for(const side of [-1,1])for(let i=0;i<=7;i++){
      const t=side<0?i/7:1-i/7,from=[-shoulder+lean[0]*round,top+lean[1]*round],to=[-shoulder+round,top];
      const x=(1-t)*(1-t)*from[0]+2*t*(1-t)*-shoulder+t*t*to[0],y=(1-t)*(1-t)*from[1]+2*t*(1-t)*top+t*t*to[1];
      points.push([side<0?x:-x,y]);
    }
    points.push([foot,1.1]);
    return points;
  }
  const outer=arch(1.24,.98,1.72,.34),inner=arch(1.03,.80,1.535,.19),handleFront=-.05,handleBack=-.27;
  const flat=(p,z)=>[p[0],p[1],z];
  const lean2=(line,i,sign)=>{const a=line[Math.max(0,i-1)],b=line[Math.min(line.length-1,i+1)];return unit([-(b[1]-a[1])*sign,(b[0]-a[0])*sign,0]);};
  for(let i=1;i<outer.length;i++){
    const o0=outer[i-1],o1=outer[i],i0=inner[i-1],i1=inner[i];
    face([flat(i0,handleFront),flat(i1,handleFront),flat(o1,handleFront),flat(o0,handleFront)],"rubber");
    face([flat(o0,handleBack),flat(o1,handleBack),flat(i1,handleBack),flat(i0,handleBack)],"rubber");
    face([flat(o0,handleFront),flat(o1,handleFront),flat(o1,handleBack),flat(o0,handleBack)],"rubber",faces,[lean2(outer,i-1,1),lean2(outer,i,1),lean2(outer,i,1),lean2(outer,i-1,1)]);
    face([flat(i0,handleBack),flat(i1,handleBack),flat(i1,handleFront),flat(i0,handleFront)],"rubber",faces,[lean2(inner,i-1,-1),lean2(inner,i,-1),lean2(inner,i,-1),lean2(inner,i-1,-1)]);
  }
  for(const side of [-1,1]){
    slab(side*1.135,1.16,-.16,.46,.07,.36,.03,"black");
    for(const z of [-.02,-.30])rod([side*1.135,1.19,z],[side*1.135,1.205,z],.03,"shine",8);
  }
  // Telescoping aerial on a knurled swivel at the rear corner.
  const mast=[1.5,1.14,-.36],slant=unit([-.44,.9,0]),along=d=>mast.map((c,k)=>c+slant[k]*d);
  rod(mast,[1.5,1.25,-.36],.078,"shine",18,true);
  rod([1.5,1.25,-.36],[1.5,1.29,-.36],.05,"black",12);
  rod(along(.14),along(.62),.036,"shine",10);
  rod(along(.62),along(1.02),.026,"shine",9);
  rod(along(1.02),along(1.36),.017,"shine",8);
  rod(along(1.36),along(1.375),.03,"shine",10);
  rod(along(1.375),along(1.42),.044,"shine",10,false,.036);
  // RF socket on the right flank and the lead: a plain run out of the plug that tightens into a coil along the bench.
  rod([1.95,-.55,-.15],[2.06,-.55,-.15],.105,"shine",6);
  rod([2.06,-.55,-.15],[2.2,-.55,-.15],.078,"shine",20,true);
  rod([2.2,-.55,-.15],[2.36,-.55,-.15],.052,"black",12,false,.04);
  const route=[[2.34,-.55,-.15],[2.56,-.56,-.06],[2.66,-.8,.3],[2.48,-1.0,.86],[1.95,-1.03,1.22],[1.2,-1.03,1.36],[.45,-1.03,1.37],[-.3,-1.03,1.3]];
  function bend(t) {
    const last=route.length-1,s=Math.min(last-1e-6,Math.max(0,t*last)),i=Math.floor(s),f=s-i;
    const at=k=>route[Math.max(0,Math.min(last,k))],[a,b,c,d]=[at(i-1),at(i),at(i+1),at(i+2)];
    return b.map((_,k)=>.5*(2*b[k]+(c[k]-a[k])*f+(2*a[k]-5*b[k]+4*c[k]-d[k])*f*f+(3*b[k]-a[k]-3*c[k]+d[k])*f*f*f));
  }
  const run=Array.from({length:241},(_,i)=>bend(i/240)),reach=[0];
  for(let i=1;i<run.length;i++)reach.push(reach[i-1]+Math.hypot(...sub(run[i],run[i-1])));
  const total=reach[240];
  function along2(distance) {
    const d=Math.max(0,Math.min(total,distance));
    let i=1;while(i<240&&reach[i]<d)i++;
    const f=(d-reach[i-1])/(reach[i]-reach[i-1]||1);
    return run[i-1].map((c,k)=>c+(run[i][k]-c)*f);
  }
  const turns=Math.round(total/.096),steps=turns*(lite?6:10),lead=[];
  let spin0;
  for(let i=0;i<=steps;i++){
    const t=i/steps,way=unit(sub(along2(t*total+.01),along2(t*total-.01)));
    spin0=spin0?unit(sub(spin0,way.map(c=>c*dot(spin0,way)))):unit(cross([0,0,1],way));
    const side=cross(way,spin0),a=t*turns*TAU,ease=Math.max(0,Math.min(1,(t-.2)*9)),loop=.108*ease*ease*(3-2*ease);
    lead.push(along2(t*total).map((c,k)=>c+loop*(Math.cos(a)*spin0[k]+Math.sin(a)*side[k])));
  }
  tube(lead,.036,"black",lite?4:7);

  // Everything that moves: the scope trace with its bloom, and the two pointers.
  function dials(value,time){
    const dynamic=[],phase=value/100,category=Math.floor(value/34);
    function wave(t){
      const p=(t*(1.8+phase*2.6)+time*.00012)%1;
      if(category===0)return 4*Math.abs(p-.5)-1;
      if(category===1)return Math.tanh(Math.sin(p*TAU)*4);
      return Math.sin(p*TAU)+.25*Math.sin(p*TAU*2);
    }
    const line=[];
    for(let i=0;i<=96;i++){const t=i/96;line.push([SCREEN.x-.95+t*1.9,SCREEN.y+wave(t)*(.24+getScope()*.07)]);}
    for(const [material,width,z] of [["haze",.05,.8545],["glow",.027,.856],["trace",.012,.8575]]){
      let before;
      line.forEach((point,i)=>{
        const a=line[Math.max(0,i-1)],b=line[Math.min(96,i+1)],length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
        const nx=-(b[1]-a[1])/length*width,ny=(b[0]-a[0])/length*width;
        const edge=[[point[0]+nx,point[1]+ny,z],[point[0]-nx,point[1]-ny,z]];
        if(before)face([before[0],before[1],edge[1],edge[0]],material,dynamic);
        before=edge;
      });
    }
    KNOBS.forEach(([id,y])=>{
      const angle=id==="tune"?SWEEP_FROM-phase*SWEEP:2.62-getScope()*1.05,dx=Math.cos(angle),dy=Math.sin(angle);
      const at=(r,w,z)=>[KNOB_X+dx*r-dy*w,y+dy*r+dx*w,z];
      face([at(.13,-.016,.944),at(.25,-.016,.944),at(.25,.016,.944),at(.13,.016,.944)],"white",dynamic);
      face([at(.29,-.016,.903),at(.337,-.016,.775),at(.337,.016,.775),at(.29,.016,.903)],"white",dynamic);
    });
    return dynamic;
  }

  // The faceplate print: brushed aluminium, wear, contact shadows and the legends.
  const sans='"Martian Grotesk", "Arial Black", Arial, sans-serif',mono='"Martian Mono", ui-monospace, Menlo, Consolas, monospace';
  function paintPlate() {
    const W=2048,H=1024,sx=W/3.81,sy=H/2.18,art=document.createElement("canvas");
    art.width=W;art.height=H;
    const c=art.getContext("2d"),ink="#141511",px=x=>(x+1.905)*sx,py=y=>(1.09-y)*sy;
    let seed=11;
    const rand=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
    c.fillStyle="#d9dad1";c.fillRect(0,0,W,H);
    for(let i=0;i<26;i++){
      const x=rand()*W,y=rand()*H,r=90+rand()*330,cloud=c.createRadialGradient(x,y,0,x,y,r),tone=rand()<.55?"36,38,28":"255,255,250";
      cloud.addColorStop(0,"rgba("+tone+","+(.05+rand()*.09)+")");cloud.addColorStop(1,"rgba("+tone+",0)");
      c.fillStyle=cloud;c.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let i=0;i<15000;i++){
      c.fillStyle=rand()<.5?"rgba(255,255,252,"+(.04+rand()*.12)+")":"rgba(24,26,18,"+(.03+rand()*.11)+")";
      c.fillRect(rand()*W-140,rand()*H,40+rand()*460,rand()<.12?2:1);
    }
    for(let i=0;i<70;i++){
      const x=rand()*W,y=rand()*H,a=(rand()-.5)*1.5,l=16+rand()*150;
      c.strokeStyle=rand()<.6?"rgba(255,255,250,.3)":"rgba(26,28,20,.26)";c.lineWidth=rand()<.2?2:1;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.stroke();
    }
    for(let i=0;i<900;i++){c.fillStyle="rgba(22,24,16,"+(.08+rand()*.22)+")";c.fillRect(rand()*W,rand()*H,1+rand()*2,1+rand()*2);}
    const grime=c.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.6);
    grime.addColorStop(0,"rgba(38,40,28,0)");grime.addColorStop(1,"rgba(38,40,28,.36)");
    c.fillStyle=grime;c.fillRect(0,0,W,H);
    const box=(x,y,w,h,r)=>{c.beginPath();c.moveTo(px(x)+r,py(y));c.arcTo(px(x+w),py(y),px(x+w),py(y-h),r);c.arcTo(px(x+w),py(y-h),px(x),py(y-h),r);c.arcTo(px(x),py(y-h),px(x),py(y),r);c.arcTo(px(x),py(y),px(x+w),py(y),r);c.closePath();};
    // The dial bay is a separate inset panel.
    box(.72,.88,.90,1.78,16);c.fillStyle="rgba(255,255,250,.07)";c.fill();
    c.strokeStyle="rgba(20,22,16,.78)";c.lineWidth=4;c.stroke();
    box(.728,.872,.884,1.764,12);c.strokeStyle="rgba(255,255,250,.3)";c.lineWidth=2;c.stroke();
    // Soft shadows where parts sit on the plate; the solid shapes end up hidden beneath them.
    c.fillStyle=ink;c.shadowColor="rgba(8,10,4,.8)";c.shadowBlur=40;c.shadowOffsetX=10;c.shadowOffsetY=17;
    c.fillRect(px(SCREEN.x-1.11),py(SCREEN.y+.70),2.22*sx,1.40*sy);
    for(const [,y] of KNOBS){c.beginPath();c.ellipse(px(KNOB_X),py(y),.38*sx,.38*sy,0,0,TAU);c.fill();}
    c.shadowBlur=16;c.shadowOffsetX=5;c.shadowOffsetY=9;
    for(const x of KEYS)c.fillRect(px(x-.12),py(-.82),.24*sx,.11*sy);
    c.beginPath();c.ellipse(px(-1.47),py(-.875),.07*sx,.07*sy,0,0,TAU);c.fill();
    c.shadowColor="transparent";c.shadowBlur=0;c.shadowOffsetX=c.shadowOffsetY=0;
    const lamp=c.createRadialGradient(px(-1.27),py(-.905),0,px(-1.27),py(-.905),.11*sx);
    lamp.addColorStop(0,"rgba(255,70,20,.7)");lamp.addColorStop(1,"rgba(255,70,20,0)");
    c.fillStyle=lamp;c.fillRect(px(-1.4),py(-.78),.26*sx,.26*sy);
    // Legends are set in plate units, at a thousandth scale so font sizes stay whole pixels.
    function legend(text,x,y,size,font,align="left",slant=0) {
      c.save();c.setTransform(sx/1000,0,-slant*sx/1000,sy/1000,px(x),py(y));
      c.font=font.replace("%",Math.round(size*1000));c.textAlign=align;c.fillStyle=ink;c.fillText(text,0,0);
      const width=c.measureText(text).width/1000;c.restore();
      return width;
    }
    const rule=(points,width)=>{c.strokeStyle=ink;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>c[i?"lineTo":"moveTo"](px(x),py(y)));c.stroke();};
    const name=legend("ODD SIGNAL",-1.5,.915,.135,"900 %px "+sans,"left",.32);
    for(let i=0;i<3;i++){c.fillStyle=ink;c.beginPath();const x=-1.5+name+.075+i*.048;c.moveTo(px(x),py(.915));c.lineTo(px(x+.018),py(.915));c.lineTo(px(x+.05),py(.985));c.lineTo(px(x+.032),py(.985));c.fill();}
    rule([[-1.5+name+.26,.918],[1.32,.918],[1.36,.948],[1.5,.948]],4);
    legend("RX–01",1.13,-1.035,.142,"900 extra-expanded %px "+sans,"center",.32);
    legend("FREQ",.86,.79,.05,"700 condensed %px "+mono);
    legend("GAIN",.86,-.045,.05,"700 condensed %px "+mono);
    legend("0",.855,-.86,.046,"700 condensed %px "+mono);
    legend("10",1.49,-.86,.046,"700 condensed %px "+mono,"right");
    legend("PWR",-1.27,-.81,.044,"700 condensed %px "+mono,"center");
    rule([[-1.115,-.775],[-1.115,-.97]],4);
    ["RX","SCOPE","FFT","REC","HOLD"].forEach((label,i)=>{
      legend(label,KEYS[i],-.752,.044,"700 condensed %px "+mono,"center");
      rule([[KEYS[i]-.085,-.795],[KEYS[i]-.085,-.778],[KEYS[i]+.085,-.778],[KEYS[i]+.085,-.795]],2.5);
    });
    return art;
  }
  // A tiling strip of brushed grain for the rest of the case.
  function paintGrain() {
    const size=256,art=document.createElement("canvas");
    art.width=art.height=size;
    const c=art.getContext("2d"),image=c.createImageData(size,size);
    let seed=5;
    const rand=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
    for(let y=0;y<size;y++){
      let streak=rand();
      const row=(rand()-.5)*.3;
      for(let x=0;x<size;x++){
        streak=streak*.93+rand()*.07;
        const blotch=.5*Math.sin(x*TAU/size+y*.11)*Math.sin(y*TAU*2/size+1.7)+.5*Math.sin((x+y)*TAU*3/size);
        const value=Math.max(0,Math.min(1,.5+(streak-.5)*3.4+row+blotch*.11-(rand()<.004?.4:0)));
        image.data.set([value*255,value*255,value*255,255],(y*size+x)*4);
      }
    }
    c.putImageData(image,0,0);
    return art;
  }

  let ctx;
  let drawGL;
  if(gl){
    const vert='attribute vec3 position,normal,tint;attribute float kind;uniform mat3 turn;uniform vec2 view;varying vec3 vN,vV,vO,vTint;varying vec2 vUV;varying float vKind;void main(){vec3 v=turn*position;gl_Position=vec4((v.x-'+SLIDE.toFixed(2)+')*view.x,(v.y-'+LIFT.toFixed(2)+')*view.y,-v.z,'+D.toFixed(2)+'-v.z);vN=turn*normal;vV=v;vO=position;vTint=tint;vKind=kind;vUV=kind>1.5&&kind<2.5?vec2((position.x+1.905)/3.81,(1.09-position.y)/2.18):(abs(normal.y)>.7?position.xz:abs(normal.x)>.7?position.zy:position.xy)*vec2(.5,1.9);}';
    const frag='precision mediump float;uniform sampler2D plate,grain;varying vec3 vN,vV,vO,vTint;varying vec2 vUV;varying float vKind;void main(){vec3 base=vTint;if(vKind>3.5&&vKind<4.5){gl_FragColor=vec4(base,1.);return;}vec3 e=normalize(vec3('+SLIDE.toFixed(2)+','+LIFT.toFixed(2)+','+D.toFixed(2)+')-vV),n=normalize(vN);if(dot(n,e)<0.)n=-n;vec3 l=normalize(vec3(-.5,.8,.75)),h=normalize(l+e);float lit=max(0.,dot(n,l)),glint=max(0.,dot(n,h)),sky=.5+.5*n.y,gloss=8.,shine=.11;if(vKind<.5){}else if(vKind<1.5){float g=texture2D(grain,vUV).r;base*=.6+.8*g;gloss=20.;shine=.2+.5*g;}else if(vKind<2.5){base=texture2D(plate,vUV).rgb;gloss=24.;shine=.55*base.g;}else if(vKind<3.5){gloss=40.;shine=.5;}else if(vKind<5.5){vec3 r=reflect(-e,n);base*=.45+.8*smoothstep(-.4,.7,r.y);gloss=60.;shine=.9;}else{base+=vec3(.012,.03,.012)*smoothstep(-.7,.9,vO.y+.35*vO.x);gloss=80.;shine=.45;}gl_FragColor=vec4(base*(.48+.2*sky+.6*lit)+vec3(1.,.98,.9)*shine*pow(glint,gloss),1.);}';
    function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
    const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vert));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))gl=null;
    else{
      gl.useProgram(program);
      const locs=["position","normal","tint","kind"].map(key=>gl.getAttribLocation(program,key));
      const turn=gl.getUniformLocation(program,"turn"),view=gl.getUniformLocation(program,"view");
      function flatten(list){
        const data=[];
        for(const f of list)for(let i=1;i<f.points.length-1;i++)for(const k of [0,i,i+1])data.push(...f.points[k],...(f.normals?f.normals[k]:f.normal),...f.color,f.kind);
        return new Float32Array(data);
      }
      function texture(unit,name,repeat){
        const wrap=repeat?gl.REPEAT:gl.CLAMP_TO_EDGE,id=gl.createTexture();
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,id);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.uniform1i(gl.getUniformLocation(program,name),unit);
        return next=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,id);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,next);gl.generateMipmap(gl.TEXTURE_2D);};
      }
      const printPlate=texture(0,"plate",false);
      printPlate(paintPlate());
      texture(1,"grain",true)(paintGrain());
      // The legends use the site typefaces, so the plate is printed again once they are certainly loaded.
      if(document.fonts&&document.fonts.load)Promise.all(['900 20px '+sans,'700 20px '+mono].map(font=>document.fonts.load(font))).then(()=>{printPlate(paintPlate());refresh();},()=>{});
      const bodyBuffer=gl.createBuffer(),movingBuffer=gl.createBuffer(),bodyData=flatten(faces);
      gl.bindBuffer(gl.ARRAY_BUFFER,bodyBuffer);gl.bufferData(gl.ARRAY_BUFFER,bodyData,gl.STATIC_DRAW);
      gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
      function drawBuffer(buffer,count){
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        locs.forEach((loc,i)=>{gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,i===3?1:3,gl.FLOAT,false,40,12*i);});
        gl.drawArrays(gl.TRIANGLES,0,count);
      }
      drawGL=(dynamic,m,kx,ky)=>{
        const change=flatten(dynamic);
        gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix3fv(turn,false,[m[0][0],m[1][0],m[2][0],m[0][1],m[1][1],m[2][1],m[0][2],m[1][2],m[2][2]]);gl.uniform2f(view,kx,ky);
        drawBuffer(bodyBuffer,bodyData.length/10);
        gl.bindBuffer(gl.ARRAY_BUFFER,movingBuffer);gl.bufferData(gl.ARRAY_BUFFER,change,gl.DYNAMIC_DRAW);
        drawBuffer(movingBuffer,change.length/10);
      };
    }
  }
  if(!gl)ctx=canvas.getContext("2d");
  // The opening pose matches the photograph: front and right flank, seen from a little above.
  let yaw=-.56,pitch=.21,active=false,frame=0,drag=null;
  const calm=window.matchMedia("(prefers-reduced-motion: reduce)");
  // Rows of the view rotation: yaw, then pitch (a camera just above the faceplate), then the fixed tilt.
  function turned(){
    const c=Math.cos(yaw),s=Math.sin(yaw),p=Math.cos(pitch),q=Math.sin(pitch),cr=Math.cos(ROLL),sr=Math.sin(ROLL);
    const a=[c,0,s],b=[q*s,p,-q*c];
    return [a.map((v,i)=>cr*v-sr*b[i]),a.map((v,i)=>sr*v+cr*b[i]),[-p*s,q,p*c]];
  }
  const spin=(m,[x,y,z])=>m.map(row=>row[0]*x+row[1]*y+row[2]*z);
  const fit=(w,h)=>Math.min(w/FIT_W,h/FIT_H)*D;
  function render(time){
    if(!active)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
    if(w<1||h<1)return;
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const k=fit(w,h),m=turned();
    const dynamic=dials(Number(range.value),calm.matches?0:time);
    if(drawGL)drawGL(dynamic,m,2*k/w,2*k/h);
    else if(ctx){
      ctx.clearRect(0,0,w,h);
      const projected=[],frontOn=m[2][2]>.05;
      for(const f of faces.concat(dynamic)){
        const v=f.points.map(point=>spin(m,point)),normal=spin(m,f.normal),count=v.length;
        const centre=[0,1,2].map(axis=>v.reduce((sum,pt)=>sum+pt[axis],0)/count);
        // Faces turned away from the camera are skipped; every solid here is closed.
        if(normal[0]*(SLIDE-centre[0])+normal[1]*(LIFT-centre[1])+normal[2]*(D-centre[2])<=0)continue;
        // Everything mounted on the faceplate is stacked in layers, so seen from the front it paints in mounting order.
        const layer=f.points.reduce((sum,pt)=>sum+pt[2],0)/count;
        const light=f.kind===4?1:.65+.39*Math.max(0,(-normal[0]*.5+normal[1]*.8+normal[2]*.9)/1.304);
        projected.push({v,z:frontOn&&layer>.745?100+layer+centre[2]*1e-4:centre[2],color:'rgb('+f.color.map(ch=>Math.round(Math.min(1,ch*light)*255)).join(',')+')'});
      }
      projected.sort((a,b)=>a.z-b.z);
      for(const f of projected){ctx.beginPath();f.v.forEach(([x,y,z],i)=>{const scale=k/(D-z);ctx[i?'lineTo':'moveTo'](w/2+(x-SLIDE)*scale,h/2-(y-LIFT)*scale);});ctx.closePath();ctx.fillStyle=f.color;ctx.fill();}
    }
  }
  let inView=true,lastFrame=-100;
  function tick(time){frame=0;if(active&&inView){if(time-lastFrame>32){render(time);lastFrame=time;}if(!calm.matches)frame=requestAnimationFrame(tick);}}
  function refresh(){cancelAnimationFrame(frame);frame=0;if(active&&inView){render(performance.now());if(!calm.matches)frame=requestAnimationFrame(tick);}}
  new ResizeObserver(refresh).observe(canvas);
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;refresh();}).observe(canvas);
  calm.addEventListener("change",refresh);
  function dialAt(event) {
    const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
    const k=fit(w,h),m=turned();
    if(m[2][2]<.15)return null;
    for(const [id,y] of KNOBS) {
      const v=spin(m,[KNOB_X,y,.94]),scale=k/(D-v[2]);
      const x2=w/2+(v[0]-SLIDE)*scale,y2=h/2-(v[1]-LIFT)*scale;
      if(Math.hypot(event.clientX-rect.left-x2,event.clientY-rect.top-y2)<Math.max(14,scale*.41))return id;
    }
    return null;
  }
  canvas.addEventListener("pointerdown",event=>{
    const mode=dialAt(event);
    drag={x:event.clientX,y:event.clientY,yaw,pitch,mode,value:Number(range.value),scope:getScope(),moved:false};
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor=mode?"ew-resize":"grabbing";
  });
  canvas.addEventListener("pointermove",event=>{
    if(!drag){canvas.style.cursor=dialAt(event)?"ew-resize":"grab";return;}
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.hypot(dx,dy)>3)drag.moved=true;
    if(drag.mode==="tune"){range.value=drag.value+Math.round((dx-dy)*.55);onTune();}
    else if(drag.mode==="scope")setScope(drag.scope+Math.round((dx-dy)/36));
    else{yaw=drag.yaw+dx*.009;pitch=Math.max(-.85,Math.min(.85,drag.pitch+dy*.008));if(calm.matches)refresh();}
  });
  canvas.addEventListener("pointerup",()=>{
    if(drag && !drag.moved){
      if(drag.mode==="scope")setScope((getScope()+1)%3);
      if(drag.mode==="tune"){range.value=[16,50,84][(Math.floor(Number(range.value)/34)+1)%3];onTune();}
    }
    drag=null;canvas.style.cursor="grab";
  });
  canvas.addEventListener("lostpointercapture",()=>{drag=null;});
  canvas.addEventListener("keydown",event=>{
    if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
    event.preventDefault();
    if(event.key==="ArrowUp"||event.key==="ArrowDown")setScope(getScope()+(event.key==="ArrowUp"?1:-1));
    else{range.value=Number(range.value)+(event.key==="ArrowRight"?1:-1);onTune();}
  });
  return {setActive(value){active=value;refresh();},refresh};
};
