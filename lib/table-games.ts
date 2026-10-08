export type Mark = "X" | "O" | null;
export function boardResult(board:Mark[]):{winner:Mark,line:number[],draw:boolean}{
 for(const line of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]){const [a,b,c]=line;if(board[a]&&board[a]===board[b]&&board[a]===board[c])return {winner:board[a],line,draw:false};}
 return {winner:null,line:[],draw:board.every(Boolean)};
}
export function shuffle<T>(values:T[]):T[]{const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export const foodCards=[{icon:"🍕",name:"Pizza"},{icon:"🍩",name:"Doughnut"},{icon:"🍓",name:"Strawberry"},{icon:"🍔",name:"Burger"},{icon:"🥑",name:"Avocado"},{icon:"🍉",name:"Watermelon"}];
export const foodQuestions=[
{question:"Which spice gives food a golden-yellow colour?",choices:["Turmeric","Salt","Black pepper","Cumin"],answer:0,explanation:"Turmeric is naturally golden yellow and adds that colour to food."},
{question:"Which of these is used to make popcorn?",choices:["Rice","Corn","Wheat","Chickpeas"],answer:1,explanation:"Popcorn is made from a special type of corn that pops when heated."},
{question:"Which fruit is the main ingredient in guacamole?",choices:["Mango","Apple","Avocado","Banana"],answer:2,explanation:"Guacamole is an avocado-based dip."},
{question:"Which of these is a pulse?",choices:["Cinnamon","Black pepper","Clove","Lentil"],answer:3,explanation:"Lentils are pulses: the edible dried seeds of legumes."},
{question:"What is the main ingredient in traditional hummus?",choices:["Chickpeas","Potatoes","Rice","Tomatoes"],answer:0,explanation:"Traditional hummus uses chickpeas, usually blended with tahini and lemon."},
{question:"Which drink is made by brewing coffee beans?",choices:["Lassi","Espresso","Lemonade","Buttermilk"],answer:1,explanation:"Espresso is concentrated coffee brewed with hot water under pressure."},
{question:"Which spice is commonly sold as sticks?",choices:["Turmeric","Cumin","Cinnamon","Mustard"],answer:2,explanation:"Cinnamon sticks are rolled pieces of dried bark."},
{question:"Which one is a citrus fruit?",choices:["Grape","Peach","Pear","Lemon"],answer:3,explanation:"Lemons belong to the citrus family, along with oranges and limes."}
];
