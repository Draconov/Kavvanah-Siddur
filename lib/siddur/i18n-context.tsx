'use client';
import {createContext,useContext} from 'react';
import type {UiLanguage} from './types';
import {getUI} from './i18n';
import {DirectionProvider} from '@/components/ui/direction';
const LanguageContext=createContext<UiLanguage>('en');
export function I18nProvider({language,children}:{language:UiLanguage;children:React.ReactNode}){return <LanguageContext.Provider value={language}><DirectionProvider dir={language==='he'?'rtl':'ltr'}>{children}</DirectionProvider></LanguageContext.Provider>;}
export function useUI(){return getUI(useContext(LanguageContext));}
