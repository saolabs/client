import {afterEach,expect,it} from 'vitest';
import {Html} from '../../src/core/elements/Html';
import {View} from '../../src/core/view/View';

afterEach(()=>{document.body.replaceChildren();});

it('preserves editor nodes, selection and listeners while updating the host config',()=>{
    const view=new View('test.dom-island','view');
    const config={attrs:{'data-sao-preserve-children':{type:'static' as const,value:'true'},contenteditable:{type:'static' as const,value:'true'}}};
    const host=new Html({ctx:view.__ctrl__,id:'editor',tagName:'div',config});
    document.body.append(host.element);host.render();
    const text=document.createTextNode('Tiếng Việt đang nhập');host.element.append(text);
    const chip=document.createElement('span');chip.contentEditable='false';chip.textContent='Input';host.element.append(chip);
    let clicked=0;chip.addEventListener('click',()=>clicked++);
    const range=document.createRange();range.setStart(text,7);range.collapse(true);window.getSelection()!.addRange(range);
    host.updateConfig({...config,attrs:{...config.attrs,title:{type:'static',value:'New title'}}});host.render();host.render();
    expect(host.element.firstChild).toBe(text);expect(host.element.lastChild).toBe(chip);
    expect(window.getSelection()!.anchorNode).toBe(text);expect(window.getSelection()!.anchorOffset).toBe(7);
    expect(host.element.title).toBe('New title');chip.click();expect(clicked).toBe(1);
    host.destroy();expect(document.body.contains(chip)).toBe(false);
});

it('continues removing unmanaged children on regular elements',()=>{
    const view=new View('test.regular-dom','view');const host=new Html({ctx:view.__ctrl__,id:'normal',tagName:'div',config:{}});
    host.element.append(document.createTextNode('Unmanaged'));host.render();expect(host.element.textContent).toBe('');host.destroy();
});
