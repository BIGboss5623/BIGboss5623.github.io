import {moveBoard,addTile,gameOver} from './engine.mjs';
const board=document.querySelector('#board'),scoreText=document.querySelector('#score'),bestText=document.querySelector('#best');
const message=document.querySelector('#message'),undo=document.querySelector('#undo');
let grid=[],score=0,best=0,previous=null,celebrated=false,touch=null;
try{best=Number(localStorage.getItem('zgland-merge-best'))||0;if(!Number.isFinite(best)||best<0)best=0;}catch{}
function render(){
 board.replaceChildren(...grid.map(value=>{
  const cell=document.createElement('div');cell.className='tile';cell.setAttribute('role','gridcell');
  cell.setAttribute('aria-label',value?String(value):'空格');cell.dataset.level=value?String(Math.min(11,Math.log2(value))):'0';cell.textContent=value||'';return cell;
 }));
 scoreText.textContent=score;bestText.textContent=best;undo.disabled=!previous;
}
function reset(){grid=addTile(addTile(Array(16).fill(0)));score=0;previous=null;celebrated=false;message.textContent='新一局开始。点击棋盘后用方向键，或使用滑动与按钮。';render();}
function move(direction){
 const next=moveBoard(grid,direction);
 if(!next.changed){message.textContent=gameOver(grid)?'没有可走的方向了，试试撤回或重新开始。':'这个方向没有变化，试试其他方向。';return;}
 previous={grid:[...grid],score,celebrated};grid=addTile(next.grid);score+=next.gain;
 if(score>best){best=score;try{localStorage.setItem('zgland-merge-best',String(best));}catch{}}
 message.textContent=next.gain?`本步合并得 ${next.gain} 分。`:'继续合并，留些空位。';
 if(!celebrated&&grid.some(v=>v>=2048)){celebrated=true;message.textContent='抵达 2048！你可以继续挑战。';}
 if(gameOver(grid))message.textContent='本局结束，可以撤回一步或重新开始。';
 render();
}
document.querySelector('#newGame').addEventListener('click',reset);
undo.addEventListener('click',()=>{if(!previous)return;({grid,score,celebrated}=previous);previous=null;message.textContent='已撤回一步，选择另一个方向吧。';render();});
document.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>move(button.dataset.direction)));
board.addEventListener('keydown',event=>{const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[event.key];if(direction){event.preventDefault();move(direction);}});
board.addEventListener('pointerdown',event=>{if(!event.isPrimary)return;touch={x:event.clientX,y:event.clientY,id:event.pointerId};board.setPointerCapture(event.pointerId);board.focus({preventScroll:true});});
board.addEventListener('pointercancel',()=>touch=null);
board.addEventListener('pointerup',event=>{if(!touch||touch.id!==event.pointerId)return;const x=event.clientX-touch.x,y=event.clientY-touch.y;touch=null;if(Math.max(Math.abs(x),Math.abs(y))<25)return;move(Math.abs(x)>Math.abs(y)?x>0?'right':'left':y>0?'down':'up');});
reset();
