import {BookOpen,BookText,CalendarDays,Clock3,Compass} from 'lucide-react';

export const APP_NAV = [
 {id:'siddur',name:'Siddur',he:'סידור',icon:BookOpen},
 {id:'tanakh',name:'Tanakh',he:'תנ״ך',icon:BookText},
 {id:'calendar',name:'Calendar',he:'לוח שנה',icon:CalendarDays},
 {id:'times',name:'Prayer times',he:'זמנים',icon:Clock3},
 {id:'compass',name:'Mizrach',he:'מזרח',icon:Compass},
] as const;
export type AppView=(typeof APP_NAV)[number]['id'];
