import NCTBHeader from "@/components/layout/NCTBHeader";


export default function AppShell({
 children,
}:{
 children: React.ReactNode;
}){

return (

<main
className="
min-h-screen
overflow-hidden
px-4
py-5
"
style={{
background:
"radial-gradient(circle at 10% 20%,rgba(0,106,78,.18),transparent 30%),radial-gradient(circle at 90% 20%,rgba(244,42,65,.18),transparent 30%),linear-gradient(135deg,#f8fffc,#fff)"
}}
>

<div className="
mx-auto
max-w-[1200px]
space-y-6
">

<NCTBHeader />

{children}

</div>


</main>

)

}