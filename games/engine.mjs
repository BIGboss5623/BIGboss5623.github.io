export function moveBoard(board,direction){
 if(!['left','right','up','down'].includes(direction))throw Error('Invalid direction');
 const grid=[...board];let gain=0;
 for(let line=0;line<4;line++){
  let ids=Array.from({length:4},(_,n)=>direction==='left'||direction==='right'?line*4+n:n*4+line);
  if(direction==='right'||direction==='down')ids.reverse();
  const values=ids.map(i=>board[i]).filter(Boolean),out=[];
  for(let n=0;n<values.length;n++){
   if(values[n]===values[n+1]){out.push(values[n]*2);gain+=values[n]*2;n++;}else out.push(values[n]);
  }
  ids.forEach((id,n)=>grid[id]=out[n]||0);
 }
 return {grid,gain,changed:grid.some((v,i)=>v!==board[i])};
}
export function addTile(board,random=Math.random){
 const grid=[...board],empty=grid.map((v,i)=>v?null:i).filter(i=>i!==null);
 if(empty.length)grid[empty[Math.floor(random()*empty.length)]]=random()<.9?2:4;
 return grid;
}
export function gameOver(board){return !board.includes(0)&&!['left','up'].some(d=>moveBoard(board,d).changed);}
