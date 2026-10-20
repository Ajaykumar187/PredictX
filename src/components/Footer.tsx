import React from 'react';
import { PageId } from './Sidebar';

interface FooterProps {
  onNavigate: (page: PageId) => void;
  activePage: PageId;
}

export const Footer: React.FC<FooterProps> = () => (
  <footer className="mt-10 pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-[11px] text-slate-500 dark:text-slate-400">
    <p>PredictX — educational analysis only, not financial advice. Market data may be delayed.</p>
  </footer>
);

export default Footer;
