'use strict';
// Clipboard fallback must expose the read-only output before selection on local pages.
const PromptActions={
 async copy(){const output=$('output'),text=output.value;if(!text){message(PromptPanel.t('先选择标签或随机生成。','Select tags or generate a prompt first.'));return false;}
  let copied=false;
  if(navigator.clipboard&&window.isSecureContext){try{await navigator.clipboard.writeText(text);copied=true;}catch{}}
  if(!copied){$('promptPreview').open=true;output.focus();output.select();try{copied=!!document.execCommand('copy');}catch{}}
  if(copied){message(PromptPanel.t('已复制 '+selected().length+' 个英文标签。','Copied '+selected().length+' English tags.'));return true;}
  message(PromptPanel.t(MobileUI.compact()?'英文结果已展开，请长按文本复制。':'英文结果已展开并选中，请按 Ctrl+C（Mac 用 ⌘C）复制。',MobileUI.compact()?'The prompt is open. Hold the text to copy it.':'Prompt opened and selected. Press Ctrl+C (⌘C on Mac) to copy.'));return false;
 },
 init(){$('copy').addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();void this.copy();},true);}
};
PromptActions.init();
