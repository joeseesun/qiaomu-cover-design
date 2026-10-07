export const en = {
  open:'Open cover designer', fromNote:'Create cover from current note', create:'New cover', name:'Name', createAction:'Create', cancel:'Cancel', untitled:'Untitled cover',
  text:'Text', rectangle:'Rectangle', circle:'Circle', image:'Image', imageVault:'Image from vault', undo:'Undo', redo:'Redo', duplicate:'Duplicate', remove:'Delete', front:'Bring forward', back:'Send backward',
  save:'Save', saved:'Saved', saving:'Saving…', failed:'Save failed — retry with Save', export:'Export PNG', insert:'Export and insert into source note', copy:'Copy image', copied:'Image copied',
  properties:'Properties', content:'Text content', size:'Font size', font:'Font family', color:'Fill color', background:'Background', opacity:'Opacity', bold:'Bold', align:'Alignment', left:'Left', center:'Center', right:'Right',
  highlight:'Highlight', none:'None', marker:'Marker', underline:'Underline', box:'Outline', layers:'Layers', empty:'Select an object to edit its properties',
  template:'Template', minimal:'Minimal', editorial:'Editorial', boldCover:'Bold headline', canvasSize:'Canvas size', resize:'Resize', width:'Width', height:'Height',
  exportFolder:'Export folder', designFolder:'Design folder', folderDesc:'A relative folder inside this vault.', invalidFolder:'Choose a relative vault folder without ..',
  invalidDesign:'Cannot open this design. The original file has been preserved.', conflict:'This file changed outside this editor. Reopen it before saving; your draft is kept in this tab.',
  noNote:'Open a Markdown note first.', exportDone:'PNG saved: {path}', error:'Action failed: {message}', sourceMissing:'The source note is missing.',
  imageLimit:'Choose a PNG, JPEG or WebP image under 10 MB.', noImages:'No PNG, JPEG or WebP images in this vault.',
  newText:'Your headline', subtext:'A small idea, a great cover.', language:'Interface language', auto:'Follow Obsidian', restart:'Reopen designer tabs after changing language.',
  chooseDesign:'Open an existing design', recent:'Recent covers', close:'Close', unsupported:'Clipboard image writing is unavailable. Export PNG instead.',
  recovered:'Unsaved draft recovered: {path}',
  locked:'Lock / unlock', about:'Version {version} · Offline editing · GitHub', move:'Position', rotation:'Rotation', zoom:'Fit canvas', templateNotice:'Templates apply to new covers. Existing artwork is preserved.',
} as const;
export type Key = keyof typeof en;
export const zh: Record<Key, string> = {
  open:'打开封面设计器', fromNote:'从当前笔记创建封面', create:'新建封面', name:'名称', createAction:'创建', cancel:'取消', untitled:'未命名封面',
  text:'文字', rectangle:'矩形', circle:'圆形', image:'图片', imageVault:'从库中选择图片', undo:'撤销', redo:'重做', duplicate:'复制对象', remove:'删除', front:'上移一层', back:'下移一层',
  save:'保存', saved:'已保存', saving:'保存中…', failed:'保存失败，请点击保存重试', export:'导出 PNG', insert:'导出并插入来源笔记', copy:'复制图片', copied:'图片已复制',
  properties:'属性', content:'文字内容', size:'字号', font:'字体', color:'填充颜色', background:'背景', opacity:'不透明度', bold:'粗体', align:'对齐', left:'左对齐', center:'居中', right:'右对齐',
  highlight:'高亮', none:'无', marker:'荧光笔', underline:'下划线', box:'描边', layers:'图层', empty:'选择画布中的对象以编辑属性',
  template:'模板', minimal:'简约', editorial:'杂志', boldCover:'醒目标题', canvasSize:'画布尺寸', resize:'调整尺寸', width:'宽度', height:'高度',
  exportFolder:'导出目录', designFolder:'设计目录', folderDesc:'当前库内的相对目录。', invalidFolder:'请输入库内相对目录，不能包含 ..',
  invalidDesign:'无法打开此设计，原文件已保留。', conflict:'文件已在其他位置修改，请重新打开后保存；此标签页保留你的草稿。',
  noNote:'请先打开一篇 Markdown 笔记。', exportDone:'PNG 已保存：{path}', error:'操作失败：{message}', sourceMissing:'来源笔记已不存在。',
  imageLimit:'请选择小于 10 MB 的 PNG、JPEG 或 WebP 图片。', noImages:'库中还没有 PNG、JPEG 或 WebP 图片。',
  newText:'写下你的标题', subtext:'一个小想法，一张好封面。', language:'界面语言', auto:'跟随 Obsidian', restart:'更改语言后重新打开设计标签页生效。',
  chooseDesign:'打开已有设计', recent:'最近封面', close:'关闭', unsupported:'当前环境不支持复制图片，请导出 PNG。',
  recovered:'未保存草稿已另存：{path}',
  locked:'锁定 / 解锁', about:'版本 {version} · 离线编辑 · GitHub', move:'位置', rotation:'旋转', zoom:'适应画布', templateNotice:'模板用于新建封面，已有设计内容将保留。',
};
export function translate(language: string, key: Key, params: Record<string, string|number> = {}): string {
  const dict = language.toLowerCase().startsWith('zh') ? zh : en;
  return dict[key].replace(/\{(\w+)\}/g, (_, token: string) => String(params[token] ?? `{${token}}`));
}
