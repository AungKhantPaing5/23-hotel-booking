export function money(amount:number,currency="MMK"){return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(amount)}
export function dateLabel(value:string){return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value))}
