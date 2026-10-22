'use client';
import {Download,MapPin,Moon,Settings2,Sun} from 'lucide-react';
import {APP_NAV, type AppView} from '@/lib/siddur/app-navigation';
import {useUI} from '@/lib/siddur/i18n-context';
import type {Settings} from '@/lib/siddur/types';

interface Props {
 view:AppView;
 navigate:(view:AppView)=>void;
 settings:Settings;
 settingsOpen:boolean;
 openSettings:()=>void;
 toggleTheme:()=>void;
 install:()=>void;
}
export function MobileNavigation({view,navigate,settings,settingsOpen,openSettings,toggleTheme,install}:Props){
 const {t}=useUI();
 const dark=['dark','black','dark-paper'].includes(settings.theme);
 return <nav className="mobile-action-nav" aria-label={t('Navigation')}>
  <div className="mobile-action-scroll" role="group" aria-label={t('Navigation')}>
   {APP_NAV.map(item=><button key={item.id} type="button" className="mobile-action-item" data-active={view===item.id} aria-current={view===item.id?'page':undefined} onClick={()=>navigate(item.id)} title={t(item.name)}>
    <item.icon size={21} aria-hidden="true"/><span>{t(item.name)}</span>
   </button>)}
   <span className="mobile-action-separator" aria-hidden="true"/>
   <button type="button" className="mobile-action-item" title={t('Change location')} onClick={openSettings}><MapPin size={21} aria-hidden="true"/><span>{t('Change location')}</span></button>
   <button type="button" className="mobile-action-item" data-active={settingsOpen} title={t('Settings')} onClick={openSettings}><Settings2 size={21} aria-hidden="true"/><span>{t('Settings')}</span></button>
   <button type="button" className="mobile-action-item" title={t('Toggle dark mode')} aria-label={t('Toggle dark mode')} onClick={toggleTheme}>{dark?<Sun size={21} aria-hidden="true"/>:<Moon size={21} aria-hidden="true"/>}<span>{t('Toggle dark mode')}</span></button>
   <button type="button" className="mobile-action-item" title={t('Install app')} onClick={install}><Download size={21} aria-hidden="true"/><span>{t('Install app')}</span></button>
  </div>
 </nav>;
}
