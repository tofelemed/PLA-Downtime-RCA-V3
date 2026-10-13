import React from 'react';
import { LOGIN_COPY } from './login-copy';

const PLANT_WEBP = '/login-plant.webp';
const PLANT_PNG = '/Isometric%20Industrial%20Processing%20Plant.png';

/**
 * Decorative illustration panel. Hidden from assistive tech; the image is the page's largest
 * contentful element, so it is never lazy-loaded.
 */
export const LoginHeroPanel: React.FC = () => (
  <aside
    aria-hidden="true"
    className="relative h-44 w-full shrink-0 overflow-hidden bg-slate-100 md:h-auto md:w-[45%] xl:w-[55%]"
  >
    <picture>
      <source srcSet={PLANT_WEBP} type="image/webp" />
      <img
        src={PLANT_PNG}
        alt=""
        width={1254}
        height={1254}
        loading="eager"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-left"
      />
    </picture>
    <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-slate-600 from-0% via-slate-600/90 via-35% to-transparent md:h-1/2" />
    <div className="absolute inset-x-0 bottom-0 px-6 pb-5 md:px-10 md:pb-10">
      <p className="text-xl font-semibold tracking-[0.12em] text-white md:text-3xl">{LOGIN_COPY.heroTitle}</p>
      <p className="mt-2 font-mono text-[10px] tracking-[0.1em] text-slate-100 lg:text-xs lg:tracking-[0.25em]">
        {LOGIN_COPY.heroSubtitle}
      </p>
    </div>
  </aside>
);
