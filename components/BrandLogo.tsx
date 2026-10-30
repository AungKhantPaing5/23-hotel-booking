import Image from "next/image";
export default function BrandLogo({size=48}:{size?:number}) {
  return <Image src="/brand/hotel-logo.jpg" alt="23 Hotel & Residence logo" width={size} height={size} style={{width:size,height:size,objectFit:"contain",flexShrink:0,borderRadius:5,background:"#fff"}} />;
}
