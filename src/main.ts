import { App, FileView, FuzzySuggestModal, getLanguage, MarkdownView, Modal, Notice, normalizePath, Plugin, PluginSettingTab, setIcon, Setting, TFile, WorkspaceLeaf } from 'obsidian';
import { Canvas, Circle, FabricImage, FabricObject, Textbox, Rect, setEnv, getEnv } from 'fabric';
import { Design, folderPath, History, parseDesign, safeName, SerialWriter, SIZES } from './model';
import { Key, translate } from './i18n';
import { homeProvider, HomeProvider, notifyHomeChanged } from './integrations/qiaomu-home';
const VIEW = 'qiaomu-cover-design';
interface Settings { designFolder: string; exportFolder: string; language: string }
const DEFAULTS: Settings = {designFolder:'Cover designs', exportFolder:'Cover designs/Exports', language:'auto'};

class PickFile extends FuzzySuggestModal<TFile> {
  constructor(app: App, private files: TFile[], private pick: (file: TFile) => void, label: string) { super(app); this.setPlaceholder(label); }
  getItems(): TFile[] { return this.files; }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { this.pick(file); }
}
class NewCover extends Modal {
  constructor(private plugin: CoverPlugin, private note?: TFile, private titleText = '') { super(plugin.app); }
  onOpen(): void {
    this.titleEl.setText(this.plugin.t('create')); this.contentEl.addClass('qc-modal');
    let name = this.titleText || this.plugin.t('untitled'); let template = 'minimal';
    new Setting(this.contentEl).setName(this.plugin.t('name')).addText(t => t.setValue(name).onChange(v => name = v));
    new Setting(this.contentEl).setName(this.plugin.t('template')).addDropdown(d => d.addOptions({minimal:this.plugin.t('minimal'),editorial:this.plugin.t('editorial'),bold:this.plugin.t('boldCover')}).onChange(v => template = v));
    new Setting(this.contentEl).addButton(b => b.setButtonText(this.plugin.t('createAction')).onClick(() => {
      b.setDisabled(true);
      void this.plugin.createDesign(name,template,this.note,this.titleText).then(() => this.close()).catch(e => {this.plugin.report(e); b.setDisabled(false);});
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}
export default class CoverPlugin extends Plugin {
  qiaomuHome?: HomeProvider;
  settings = DEFAULTS; private writer = new SerialWriter();
  t(key: Key, params?: Record<string,string|number>): string { return translate(this.settings.language === 'auto' ? getLanguage() : this.settings.language,key,params); }
  report(error: unknown): void { new Notice(this.t('error',{message:error instanceof Error ? error.message : String(error)})); }
  async onload(): Promise<void> {
    this.settings = {...DEFAULTS,...await this.loadData() as Partial<Settings>};
    this.registerView(VIEW,leaf => new CoverView(leaf,this));
    this.registerExtensions(['qcover'],VIEW);
    this.qiaomuHome = homeProvider({
      sections: () => [{id:'recent-covers',title:this.t('recent'),items:this.designs().slice(0,6).map(file=>({id:file.path,title:file.basename,icon:'image',open:()=>this.openDesign(file)}))}],
      actions: () => [{id:'new-cover',label:this.t('create'),icon:'image-plus',run:()=>new NewCover(this).open()}],
      search: (query,limit) => this.designs().filter(f=>f.basename.toLowerCase().includes(query.toLowerCase())).slice(0,Math.max(0,limit)).map(file=>({id:file.path,title:file.basename,icon:'image',open:()=>this.openDesign(file)}))
    });
    const notify = (file: unknown): void => {if(file instanceof TFile && file.extension==='qcover')notifyHomeChanged(this.app,this.manifest.id);};
    this.registerEvent(this.app.vault.on('create',notify));
    this.registerEvent(this.app.vault.on('modify',notify));
    this.registerEvent(this.app.vault.on('delete',notify));
    this.addCommand({id:'new-cover',name:this.t('create'),callback:() => new NewCover(this).open()});
    this.addCommand({id:'open-designer',name:this.t('open'),callback:() => this.chooseDesign()});
    this.addCommand({id:'cover-from-note',name:this.t('fromNote'),checkCallback:checking => {
      const note = this.app.workspace.getActiveFile(); const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
      if (!note || note.extension !== 'md') return false;
      if (!checking) new NewCover(this,note,editor?.getSelection() || note.basename).open();
      return true;
    }});
    this.addRibbonIcon('image',this.t('open'),() => this.chooseDesign());
    this.addSettingTab(new CoverSettings(this.app,this));
    this.registerEvent(this.app.workspace.on('file-menu',(menu,file) => {
      if (file instanceof TFile && file.extension === 'md') menu.addItem(item => item.setTitle(this.t('fromNote')).setIcon('image').onClick(() => new NewCover(this,file,file.basename).open()));
    }));
    this.registerEvent(this.app.vault.on('rename',(file,old) => {
      if (!(file instanceof TFile)) return;
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
        const view = leaf.view as CoverView;
        if (view.design?.source === old) { view.design.source = file.path; view.changed(); }
      }
    }));
  }
  chooseDesign(): void {
    const files = this.designs();
    if (!files.length) { new NewCover(this).open(); return; }
    new PickFile(this.app,files,file => { void this.openDesign(file).catch(e => this.report(e)); },this.t('chooseDesign')).open();
  }
  designs(): TFile[] { return this.app.vault.getFiles().filter(f => f.extension === 'qcover').sort((a,b) => b.stat.mtime-a.stat.mtime); }
  async openDesign(file: TFile): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW).find(l => (l.view as CoverView).file?.path === file.path);
    if (existing) { await this.app.workspace.revealLeaf(existing); return; }
    await this.app.workspace.getLeaf('tab').openFile(file);
  }
  async ensureFolder(path: string): Promise<void> {
    const parts = folderPath(path).split('/'); let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        try { await this.app.vault.createFolder(current); } catch(e) { if (!this.app.vault.getAbstractFileByPath(current)) throw e; }
      }
    }
  }
  unique(folder: string,name: string,extension: string): string {
    const base = normalizePath(`${folder}/${safeName(name)}`); let path = `${base}.${extension}`; let i = 1;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${base} ${i++}.${extension}`;
    return path;
  }
  async createDesign(name: string, template: string, note?: TFile, title?: string): Promise<TFile> {
    return this.createFile(name,await initialDesign(template,title || name,this.t('subtext'),note?.path));
  }
  private async createFile(name: string, design: Design): Promise<TFile> {
    let created: TFile|undefined;
    await this.writer.run(async () => {
      const folder = folderPath(this.settings.designFolder); await this.ensureFolder(folder);
      created = await this.app.vault.create(this.unique(folder,name,'qcover'),JSON.stringify(design,null,2));
    });
    await this.openDesign(created!); return created!;
  }
  async duplicateDesign(name: string, design: Design): Promise<TFile> { return this.createFile(name,structuredClone(design)); }
  saveSettings(): Promise<void> { return this.saveData(this.settings); }
}

async function initialDesign(template: string, title: string, subtitle: string, source?: string): Promise<Design> {
  const editorial = template === 'editorial'; const bold = template === 'bold';
  const paper = bold ? '#ffe04b' : editorial ? '#f5f0e5' : '#ffffff';
  const headline = new Textbox(title,{left:80,top:editorial?320:250,width:800,fontSize:112,fontFamily:editorial?'Georgia':'sans-serif',fontWeight:'bold',fill:'#171717',lineHeight:1.18,originX:'left',originY:'top'});
  const caption = new Textbox(subtitle,{left:84,top:1020,width:780,fontSize:30,fontFamily:'sans-serif',fill:'#525252',originX:'left',originY:'top'});
  const rule = new Rect({left:84,top:160,width:bold?180:792,height:bold?16:3,fill:'#171717',originX:'left',originY:'top'});
  return {format:'qiaomu-cover-design',schema:1,width:960,height:1280,source,canvas:{version:'7.4.0',background:paper,objects:[rule.toObject(),headline.toObject(),caption.toObject()]}};
}

export class CoverView extends FileView {
  canvas?: Canvas; design?: Design; private expected = ''; private writer = new SerialWriter(); private history = new History();
  private restoring = false; private closingView = false; private dirty = false; private timer?: number; private revision = 0;
  private stage?: HTMLElement; private props?: HTMLElement; private layerList?: HTMLElement; private saveStatusEl?: HTMLElement;
  private observer?: ResizeObserver; private generation = 0; private task = false;
  constructor(leaf: WorkspaceLeaf, public plugin: CoverPlugin) { super(leaf); }
  getViewType(): string { return VIEW; }
  getDisplayText(): string { return this.file?.basename || this.plugin.t('open'); }
  getIcon(): string { return 'image'; }
  async onOpen(): Promise<void> { this.contentEl.addClass('qc-root'); }
  async onLoadFile(file: TFile): Promise<void> {
    const generation = ++this.generation; this.closingView = false; this.restoring = true; this.dirty = false;
    try {
      const raw = await this.app.vault.read(file); const design = parseDesign(raw);
      if (generation !== this.generation) return;
      this.expected = raw; this.design = design;
      await this.build();
      if (generation !== this.generation || !this.canvas) return;
      await this.canvas.loadFromJSON(design.canvas);
      this.fit(); this.history.reset(this.snapshot()); this.restoring = false;
      this.renderProperties(); this.renderLayers(); this.setStatus('saved');
    } catch(e) {
      this.restoring = true; this.contentEl.empty(); this.contentEl.createEl('p',{text:this.plugin.t('invalidDesign')}); this.plugin.report(e);
    }
  }
  async onUnloadFile(): Promise<void> {
    this.closingView = true; this.clearTimer(); await this.flush();
    if (this.dirty && this.canvas && this.file && this.design && !this.restoring) {
      const folder = folderPath(this.plugin.settings.designFolder);
      await this.plugin.ensureFolder(folder);
      const recovery = await this.app.vault.create(this.plugin.unique(folder,`${this.file.basename} recovery ${Date.now()}`,'qcover'),JSON.stringify(this.currentDesign(),null,2));
      new Notice(this.plugin.t('recovered',{path:recovery.path}));
      this.dirty = false;
    }
    ++this.generation;
    this.observer?.disconnect(); this.observer = undefined;
    if (this.canvas) await this.canvas.dispose(); this.canvas = undefined; this.design = undefined;
    this.contentEl.empty();
  }
  async onClose(): Promise<void> { if (this.canvas) await this.onUnloadFile(); }
  private clearTimer(): void {
    if (this.timer !== undefined) this.contentEl.ownerDocument.defaultView?.clearTimeout(this.timer); this.timer = undefined;
  }
  private setStatus(key: Key): void { this.saveStatusEl?.setText(this.plugin.t(key)); }
  private async action(fn: () => void|Promise<unknown>): Promise<void> {
    if (this.task || this.restoring || this.closingView) return;
    this.task = true;
    try { await fn(); } catch(e) { this.plugin.report(e); } finally { this.task = false; }
  }
  private button(parent: HTMLElement,key: Key,fn: () => void|Promise<unknown>,primary = false): HTMLButtonElement {
    const icons: Partial<Record<Key,string>> = {text:'type',rectangle:'square',circle:'circle',image:'image-plus',imageVault:'folder-open',undo:'undo-2',redo:'redo-2',duplicate:'copy',remove:'trash-2',save:'save',copy:'clipboard-copy',front:'bring-to-front',back:'send-to-back',locked:'lock-keyhole',zoom:'scan'};
    const b = parent.createEl('button',{cls:primary?'qc-primary':''});
    const icon = icons[key];
    if (icon) {setIcon(b,icon);b.createEl('span',{text:this.plugin.t(key),cls:'qc-sr-only'});}
    else b.setText(this.plugin.t(key));
    this.registerDomEvent(b,'click',() => { void this.action(fn); }); return b;
  }
  private async build(): Promise<void> {
    if (this.canvas) await this.canvas.dispose(); this.observer?.disconnect();
    this.contentEl.empty(); const toolbar = this.contentEl.createDiv('qc-toolbar');
    this.button(toolbar,'create',() => new NewCover(this.plugin).open());
    this.button(toolbar,'text',() => this.addText()); this.button(toolbar,'rectangle',() => this.addShape('rect')); this.button(toolbar,'circle',() => this.addShape('circle'));
    this.button(toolbar,'image',() => this.pickImage()); this.button(toolbar,'imageVault',() => this.pickVaultImage());
    this.button(toolbar,'undo',() => this.travel(-1)); this.button(toolbar,'redo',() => this.travel(1));
    this.button(toolbar,'duplicate',() => this.cloneSelection()); this.button(toolbar,'remove',() => this.removeSelection());
    this.button(toolbar,'save',() => this.flush());
    this.button(toolbar,'export',() => this.exportPng(false),true);
    if (this.design?.source) this.button(toolbar,'insert',() => this.exportPng(true));
    this.button(toolbar,'copy',() => this.copyPng());
    this.saveStatusEl = toolbar.createEl('span',{cls:'qc-status'});
    const body = this.contentEl.createDiv('qc-body'); this.stage = body.createDiv('qc-stage');
    const element = this.stage.createEl('canvas');
    // Fabric uses its environment document for event listeners and IME textareas.
    const win = element.ownerDocument.defaultView!;
    setEnv({...getEnv(),document:element.ownerDocument,window:win});
    this.canvas = new Canvas(element,{width:this.design!.width,height:this.design!.height,backgroundColor:'#ffffff',preserveObjectStacking:true,selectionColor:'rgba(120,120,120,0.12)',selectionBorderColor:'#777'});
    this.canvas.on('object:modified',() => this.changed()); this.canvas.on('object:added',() => this.changed()); this.canvas.on('object:removed',() => this.changed()); this.canvas.on('text:changed',() => this.changed());
    for (const event of ['selection:created','selection:updated','selection:cleared'] as const) this.canvas.on(event,() => {this.renderProperties();this.renderLayers();});
    this.registerDomEvent(this.stage,'keydown',(event: KeyboardEvent) => this.keyboard(event));
    this.stage.tabIndex = 0;
    const sidebar = body.createDiv('qc-sidebar'); this.props = sidebar.createDiv(); this.layerList = sidebar.createDiv();
    this.observer = new win.ResizeObserver(() => this.fit()); this.observer.observe(this.stage);
    const footer = this.contentEl.createDiv('qc-footer'); this.button(footer,'zoom',() => this.fit());
    const sizeLabel = footer.createEl('label',{text:this.plugin.t('canvasSize')}); const select = sizeLabel.createEl('select');
    for (const [w,h] of SIZES) select.createEl('option',{text:`${w} × ${h}`,value:`${w},${h}`});
    select.value = `${this.design!.width},${this.design!.height}`;
    this.registerDomEvent(select,'change',() => { const [w,h] = select.value.split(',').map(Number); this.resize(w!,h!); });
    this.colorInput(footer,'background',String(this.design!.canvas.background || '#ffffff'),color => {this.canvas!.backgroundColor=color;this.changed();this.canvas!.requestRenderAll();});
    this.button(footer,'duplicate',() => this.plugin.duplicateDesign(`${this.file!.basename} copy`,this.currentDesign()));
  }
  fit(): void {
    if (!this.canvas || !this.design || !this.stage) return;
    const width = Math.max(120,this.stage.clientWidth-48), height = Math.max(160,this.stage.clientHeight-48);
    const scale = Math.min(width/this.design.width,height/this.design.height,1);
    this.canvas.setDimensions({width:Math.round(this.design.width*scale),height:Math.round(this.design.height*scale)});
    this.canvas.setZoom(scale); this.canvas.calcOffset(); this.canvas.requestRenderAll();
  }
  resize(width: number,height: number): void {
    if (!this.design || !Number.isInteger(width) || !Number.isInteger(height) || width < 200 || height < 200 || width > 4096 || height > 4096) return;
    this.design.width=width;this.design.height=height;this.fit();this.changed();
  }
  currentDesign(): Design { return {...this.design!,canvas:this.canvas!.toObject() as Record<string,unknown>}; }
  private snapshot(): string { return JSON.stringify(this.currentDesign()); }
  changed(): void {
    if (this.restoring || !this.canvas || !this.design || this.closingView) return;
    this.dirty = true; ++this.revision; this.setStatus('saving'); this.clearTimer();
    this.history.push(this.snapshot()); this.renderLayers();
    this.timer = this.contentEl.ownerDocument.defaultView!.setTimeout(() => { void this.flush(); },700);
  }
  async flush(): Promise<void> {
    this.clearTimer();
    await this.writer.run(async () => {
      if (!this.dirty || !this.file || !this.canvas || this.restoring) return;
      const file = this.file; const revision = this.revision; const raw = JSON.stringify(this.currentDesign(),null,2); const expected = this.expected;
      try {
        await this.app.vault.process(file,old => {if(old !== expected) throw new Error(this.plugin.t('conflict')); return raw;});
        this.expected = raw;
        if (revision === this.revision) {this.dirty=false;this.setStatus('saved');} else this.setStatus('saving');
      } catch(e) { this.setStatus('failed'); this.plugin.report(e); }
    });
  }
  addText(): void {
    if (!this.canvas || !this.design) return;
    const text = new Textbox(this.plugin.t('newText'),{left:80,top:160,width:this.design.width-160,fontSize:88,fontFamily:'sans-serif',fill:'#171717',originX:'left',originY:'top'});
    this.canvas.add(text);this.canvas.setActiveObject(text);this.canvas.requestRenderAll();this.renderProperties();
  }
  addShape(type: 'rect'|'circle'): void {
    if (!this.canvas) return;
    const options = {left:100,top:160,fill:'#e5e5e5',originX:'left' as const,originY:'top' as const};
    const object = type === 'rect' ? new Rect({...options,width:320,height:180,rx:16,ry:16}) : new Circle({...options,radius:100});
    this.canvas.add(object);this.canvas.setActiveObject(object);this.canvas.requestRenderAll();this.renderProperties();
  }
  removeSelection(): void { if(this.canvas){this.canvas.remove(...this.canvas.getActiveObjects());this.canvas.discardActiveObject();this.canvas.requestRenderAll();this.renderProperties();} }
  async cloneSelection(): Promise<void> {
    const canvas=this.canvas; if(!canvas) return; const generation=this.generation;
    const copies = await Promise.all(canvas.getActiveObjects().map(o => o.clone()));
    if(generation!==this.generation || this.closingView) return;
    for(const copy of copies) {copy.set({left:copy.left+30,top:copy.top+30});canvas.add(copy);} if(copies[0]) canvas.setActiveObject(copies[0]);canvas.requestRenderAll();
  }
  async travel(direction: -1|1): Promise<void> {
    const snapshot=this.history.step(direction);if(!snapshot||!this.canvas)return;
    const d=parseDesign(snapshot);this.restoring=true;
    try {await this.canvas.loadFromJSON(d.canvas);this.design=d;this.fit();} finally {this.restoring=false;}
    this.dirty=true;++this.revision;this.renderProperties();this.renderLayers();await this.flush();
  }
  private keyboard(event: KeyboardEvent): void {
    const target=event.target as HTMLElement;
    if(target.closest('input,textarea,select,[contenteditable="true"]') || this.canvas?.getActiveObjects().some(o => o instanceof Textbox && o.isEditing)) return;
    const mod=event.metaKey||event.ctrlKey;let run: (() => void|Promise<unknown>)|undefined;
    if(mod&&event.key.toLowerCase()==='z')run=() => this.travel(event.shiftKey?1:-1);
    else if(mod&&event.key.toLowerCase()==='s')run=() => this.flush();
    else if(mod&&event.key.toLowerCase()==='d')run=() => this.cloneSelection();
    else if(event.key==='Delete'||event.key==='Backspace')run=() => this.removeSelection();
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))run=() => {
      for(const o of this.canvas?.getActiveObjects()||[]){ if(o.lockMovementX)continue;const n=event.shiftKey?10:1;o.set({left:o.left+(event.key==='ArrowLeft'?-n:event.key==='ArrowRight'?n:0),top:o.top+(event.key==='ArrowUp'?-n:event.key==='ArrowDown'?n:0)});o.setCoords();}
      this.canvas?.requestRenderAll();this.changed();
    };
    if(run){event.preventDefault();event.stopPropagation();void this.action(run);}
  }
  private input(parent: HTMLElement,key: Key,value: string,fn: (value: string) => void,type = 'text'): HTMLInputElement {
    const label=parent.createEl('label',{cls:'qc-field'});label.createEl('span',{text:this.plugin.t(key)});
    const input=label.createEl('input',{type,value});this.registerDomEvent(input,'input',() => fn(input.value));return input;
  }
  private colorInput(parent: HTMLElement,key: Key,value: string,fn: (color:string)=>void): void {this.input(parent,key,/^#[\da-f]{6}$/i.test(value)?value:'#171717',fn,'color');}
  private update(object: FabricObject, props: Record<string,unknown>): void {object.set(props);object.setCoords();this.canvas?.requestRenderAll();this.changed();}
  private renderProperties(): void {
    if(!this.props || !this.canvas)return;this.props.empty();this.props.createEl('h3',{text:this.plugin.t('properties')});
    const object=this.canvas.getActiveObject();if(!object){this.props.createEl('p',{text:this.plugin.t('empty'),cls:'qc-muted'});return;}
    if(object instanceof Textbox){
      const label=this.props.createEl('label',{cls:'qc-field'});label.createEl('span',{text:this.plugin.t('content')});const text=label.createEl('textarea');text.value=object.text;
      this.registerDomEvent(text,'input',() => this.update(object,{text:text.value}));
      const size=this.input(this.props,'size',String(object.fontSize),v=> {const n=Number(v);if(n>=8&&n<=500)this.update(object,{fontSize:n});},'number');size.min='8';size.max='500';
      this.input(this.props,'font',object.fontFamily,v=>this.update(object,{fontFamily:v||'sans-serif'}));
      this.button(this.props,'bold',()=>this.update(object,{fontWeight:object.fontWeight==='bold'?'normal':'bold'}));
      const row=this.props.createDiv('qc-row');for(const key of ['left','center','right'] as const)this.button(row,key,()=>this.update(object,{textAlign:key}));
      const highlight=this.props.createEl('label',{cls:'qc-field'});highlight.createEl('span',{text:this.plugin.t('highlight')});const select=highlight.createEl('select');
      for(const key of ['none','marker','underline','box'] as const)select.createEl('option',{value:key,text:this.plugin.t(key)});
      select.value=object.textBackgroundColor?'marker':object.underline?'underline':object.strokeWidth&&object.stroke?'box':'none';
      this.registerDomEvent(select,'change',()=>this.update(object,{textBackgroundColor:select.value==='marker'?'#ffe04b':'',underline:select.value==='underline',stroke:select.value==='box'?'#171717':null,strokeWidth:select.value==='box'?1:0}));
    }
    if(!(object instanceof FabricImage))this.colorInput(this.props,'color',String(object.fill),color=>this.update(object,{fill:color}));
    const opacity=this.input(this.props,'opacity',String(Math.round(object.opacity*100)),v=>{const n=Number(v);if(n>=0&&n<=100)this.update(object,{opacity:n/100});},'range');opacity.min='0';opacity.max='100';
    const angle=this.input(this.props,'rotation',String(Math.round(object.angle)),v=>{const n=Number(v);if(Number.isFinite(n))this.update(object,{angle:n});},'number');angle.min='-360';angle.max='360';
    const row=this.props.createDiv('qc-row');this.button(row,'front',()=>{this.canvas!.bringObjectForward(object);this.changed();});this.button(row,'back',()=>{this.canvas!.sendObjectBackwards(object);this.changed();});
    this.button(this.props,'locked',()=>{const locked=!object.lockMovementX;this.update(object,{lockMovementX:locked,lockMovementY:locked,lockScalingX:locked,lockScalingY:locked,lockRotation:locked,editable:!locked});});
  }
  private renderLayers(): void {
    if(!this.layerList||!this.canvas)return;this.layerList.empty();this.layerList.createEl('h3',{text:this.plugin.t('layers')});
    for(const object of [...this.canvas.getObjects()].reverse()){
      const name=object instanceof Textbox?object.text.slice(0,35):object instanceof FabricImage?this.plugin.t('image'):object instanceof Circle?this.plugin.t('circle'):this.plugin.t('rectangle');
      const button=this.layerList.createEl('button',{text:name,cls:'qc-layer'});button.classList.toggle('is-selected',this.canvas.getActiveObject()===object);
      this.registerDomEvent(button,'click',()=>{this.canvas!.setActiveObject(object);this.canvas!.requestRenderAll();this.renderProperties();this.renderLayers();});
    }
  }
  private pickImage(): void {
    const input=this.contentEl.ownerDocument.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';
    input.addEventListener('change',()=>{const file=input.files?.[0];if(file)void this.action(()=>this.importImage(file));},{once:true});input.click();
  }
  private pickVaultImage(): void {
    const files=this.app.vault.getFiles().filter(f=>/^(png|jpe?g|webp)$/i.test(f.extension));
    if(!files.length){new Notice(this.plugin.t('noImages'));return;}
    const generation=this.generation;
    new PickFile(this.app,files,file=>{void this.action(async()=>{
      const data=await this.app.vault.readBinary(file);if(generation!==this.generation)return;
      await this.importImage(new Blob([data],{type:file.extension.toLowerCase()==='webp'?'image/webp':file.extension.toLowerCase()==='png'?'image/png':'image/jpeg'}));
    });},this.plugin.t('imageVault')).open();
  }
  async importImage(blob: Blob): Promise<void> {
    if(blob.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(blob.type))throw new Error(this.plugin.t('imageLimit'));
    const generation=this.generation;const win=this.contentEl.ownerDocument.defaultView!;
    const url=await new Promise<string>((resolve,reject)=>{const reader=new win.FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
    const image=await FabricImage.fromURL(url);
    if(generation!==this.generation||this.closingView||!this.canvas||!this.design)return;
    image.scaleToWidth(Math.min(this.design.width*0.7,image.width));image.set({left:80,top:200,originX:'left',originY:'top'});this.canvas.add(image);this.canvas.setActiveObject(image);this.canvas.requestRenderAll();this.renderProperties();
  }
  png(): HTMLCanvasElement {
    if(!this.canvas||!this.design)throw new Error('no-canvas');
    const transform = [...this.canvas.viewportTransform] as [number,number,number,number,number,number];
    this.canvas.viewportTransform = [1,0,0,1,0,0];
    try { return this.canvas.toCanvasElement(1,{left:0,top:0,width:this.design.width,height:this.design.height}); }
    finally { this.canvas.viewportTransform = transform; this.canvas.calcViewportBoundaries(); }
  }
  private async pngBlob(): Promise<Blob> {return new Promise((resolve,reject)=>this.png().toBlob(blob=>blob?resolve(blob):reject(new Error('png-export-failed')),'image/png'));}
  async exportPng(insert: boolean): Promise<TFile> {
    const sourcePath=this.design?.source;const source=sourcePath?this.app.vault.getAbstractFileByPath(sourcePath):null;
    if(insert&&(!(source instanceof TFile)||source.extension!=='md'))throw new Error(this.plugin.t('sourceMissing'));
    await this.flush();const blob=await this.pngBlob();const folder=folderPath(this.plugin.settings.exportFolder);await this.plugin.ensureFolder(folder);
    const file=await this.app.vault.createBinary(this.plugin.unique(folder,this.file?.basename||'Cover','png'),await blob.arrayBuffer());
    if(insert && source instanceof TFile) {
      const link=this.app.fileManager.generateMarkdownLink(file,source.path);const embed=link.startsWith('!')?link:`!${link}`;
      await this.app.vault.process(source,text=>`${text.trimEnd()}\n\n${embed}\n`);
    }
    new Notice(this.plugin.t('exportDone',{path:file.path}));return file;
  }
  private async copyPng(): Promise<void> {
    const win=this.contentEl.ownerDocument.defaultView!;if(!win.ClipboardItem||!win.navigator.clipboard?.write)throw new Error(this.plugin.t('unsupported'));
    const blob=await this.pngBlob();await win.navigator.clipboard.write([new win.ClipboardItem({'image/png':blob})]);new Notice(this.plugin.t('copied'));
  }
}
class CoverSettings extends PluginSettingTab {
  constructor(app:App,private plugin:CoverPlugin){super(app,plugin);}
  display():void {
    this.containerEl.empty();this.containerEl.addClass('qc-settings');
    for(const key of ['designFolder','exportFolder'] as const){
      new Setting(this.containerEl).setName(this.plugin.t(key)).setDesc(this.plugin.t('folderDesc')).addText(text=>text.setValue(this.plugin.settings[key]).onChange(value=>{
        try{this.plugin.settings[key]=folderPath(value);void this.plugin.saveSettings().catch(e=>this.plugin.report(e));text.inputEl.removeClass('qc-invalid');}
        catch{text.inputEl.addClass('qc-invalid');}
      }));
    }
    new Setting(this.containerEl).setName(this.plugin.t('language')).setDesc(this.plugin.t('restart')).addDropdown(d=>d.addOptions({auto:this.plugin.t('auto'),zh:'中文',en:'English'}).setValue(this.plugin.settings.language).onChange(value=>{this.plugin.settings.language=value;void this.plugin.saveSettings().catch(e=>this.plugin.report(e));}));
    this.containerEl.createEl('a',{text:this.plugin.t('about',{version:this.plugin.manifest.version}),href:'https://github.com/joeseesun/qiaomu-cover-design'});
  }
}
