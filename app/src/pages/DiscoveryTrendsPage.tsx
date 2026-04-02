import { Link } from 'react-router-dom'

function FullBleed({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen max-w-[100vw] relative left-1/2 -translate-x-1/2">
      {children}
    </div>
  )
}

export function DiscoveryTrendsPage() {
  return (
    <div className="discovery-trends pb-16 -mt-2">
      <FullBleed>
        <section className="relative min-h-[min(82vh,52rem)] w-full overflow-hidden flex items-end px-6 sm:px-10 lg:px-16 pb-16 sm:pb-24 group">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent z-10" />
            <img
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              alt=""
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAA1In5eGF1DGL4SZSyyvK8TpGl0F4NIufV1p9-xUQjshfBpRWHH-9Pn5RBzE39CAgLBw1HDBc950KAJwE479MGc3P0BUx5HZv6XuS51V1KyO8LWKkR4YlinEm8aokVLdLUIVXUKRcM4gDXHKzXd21QMxv_NocoAjg2dgawLcjM6QYNi7MyOK-Zlhpiod3inn-uZ7tFg3PPT_i7cqD9EVxcQIpXq9T40IjLZs_gD2Dp_Nbo37yNfSIwHMWkJ9Jy0ww-i4IVP7jXZw"
            />
          </div>
          <div className="relative z-20 max-w-4xl">
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-blue-400 mb-4 block">
              Rental Shoe · Discovery
            </span>
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-6 leading-none">
              STYLE IN
              <br />
              MOTION.
            </h1>
            <p className="text-lg text-slate-300 max-w-xl font-light leading-relaxed mb-8">
              Curated footwear for every step—rent premium pairs without the commitment. Start with
              our collection or see how renting works.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/shoes"
                className="inline-flex items-center justify-center bg-white text-slate-900 px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-primary hover:text-white transition-all duration-300"
              >
                Explore collection
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center bg-white/10 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-white/20 transition-all duration-300"
              >
                How it works
              </Link>
            </div>
          </div>
        </section>
      </FullBleed>

      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase mb-2">
              Top picks
            </h2>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm sm:text-base">
              Handpicked styles from our rental catalog—updated as new pairs arrive.
            </p>
          </div>
          <Link
            to="/shoes"
            className="text-primary font-bold text-sm uppercase tracking-widest flex items-center gap-2 group shrink-0"
          >
            View all{' '}
            <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {[
            {
              rank: '#1',
              tag: 'Oxford',
              title: 'Heritage formal',
              sub: 'From $25 / day',
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0wT30EYU758w4LwKH4JEguLGZ3EfdgAtbFNnsbPJKeGnS4BfPN74ovDp8PloSMssJBOdSqtDPIoN2LATHGzUL9SRaHfs1X8W8a4U-OQhofseinhfoeLMGZmD7YDpYgKSyvZ4m4B32YqTM0i65VUISoiGyn4yMdeEc9zcqNOcmJwUgOxxr5DDg2I6kVAWcyLnkMbxmZJDrcjfn-fIAnZ50RIAqbhkB1mLCF8bcYTCRznCyWnAR71gx2ofcmGBCBeIzJFbYy-d8Ag',
            },
            {
              rank: '#2',
              tag: 'Sneakers',
              title: 'Street performance',
              sub: 'From $18 / day',
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjIVsHCeV5MkhpmR0g6jIXgxyILcEs7jyCyEgLPCY8jxb-0ThRkGcgqx_RYKhf9UkRJpyQCkPnJLPa1UQ6khAOktHlceYKTgzSIdkCzMMR8QFtYXYBA4_UVixWs7BFni41aVUvXJMW-2-gl6n6hzUFuy-c3Q4bqRKe5M8C5TzFDJ742ZjzI-wH1JDbLZZhi3l6XfZMD378KXiUE0bJDOz4z2Wlh-z4oDbsMz7BYvXN4i5T2ewKntBQVE-Z7CAnqmXRAdDYueFLVg',
            },
            {
              rank: '#3',
              tag: 'Boots',
              title: 'All-weather edge',
              sub: 'From $22 / day',
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAA1In5eGF1DGL4SZSyyvK8TpGl0F4NIufV1p9-xUQjshfBpRWHH-9Pn5RBzE39CAgLBw1HDBc950KAJwE479MGc3P0BUx5HZv6XuS51V1KyO8LWKkR4YlinEm8aokVLdLUIVXUKRcM4gDXHKzXd21QMxv_NocoAjg2dgawLcjM6QYNi7MyOK-Zlhpiod3inn-uZ7tFg3PPT_i7cqD9EVxcQIpXq9T40IjLZs_gD2Dp_Nbo37yNfSIwHMWkJ9Jy0ww-i4IVP7jXZw',
            },
            {
              rank: '#4',
              tag: 'Loafers',
              title: 'Everyday luxury',
              sub: 'From $20 / day',
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCIQlg3h7os9SzlEKGsB4L-zS8jStlaHJq4VLBXsXlnxnNuAljnEomlKBEFeUIgoUdb-qXmekBLhpV_QBzFamE8QKep9OrQ2ccJ1LMbKcEu3XpDOXyH00pcZ7HQxF5pIbJSqpZA2O07TJehSh6WD7s-HJFQqL7jL8bNNYRdqri4T9Iy2F5AANlNxF28MDgKrxfH3OO5g7GsHfw6bKCPniU-1mwG1elBBK41K-eSOIk8l5OMvMN0gB35WUvYnRVP06NbN20Yr1Jjeg',
            },
            {
              rank: '#5',
              tag: 'Statement',
              title: 'Event ready',
              sub: 'From $28 / day',
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQd7Z0I5oCfJr9mAM2fTfqD1JqXfnBXr4jStwVdbanRA_xUMC_HbMSyZ4g-XN8bIIC7SYrSkZW7E1C4rX-byF3Yhy9PIsFd9qlxuVRkMuxbUhpz0e0eTVdTGlz4fbibvWky4MiKKnxCo4Cr2CwmnpzzMlENPgxINJmVA8PX1XhvCsTHePJfsHHWmF9fNOrrPAahVhq0zo-z-NciyxtDKoWn4Z3Ot-NQe3QniWX32jwRYSL3wlXKXBKBwRvLdor8L4wppK0aP9WDg',
            },
          ].map((card) => (
            <Link
              key={card.rank}
              to="/shoes"
              className="group cursor-pointer rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary/40 hover:shadow-lg transition-all"
            >
              <div className="aspect-[4/5] relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  alt=""
                  src={card.img}
                />
                <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase text-slate-800 dark:text-slate-200">
                  {card.rank}
                </div>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">
                  {card.tag}
                </p>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight mb-1">
                  {card.title}
                </h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-24 px-0 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-700/10 skew-x-12 translate-x-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-0 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="material-symbols-outlined text-orange-500"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  local_fire_department
                </span>
                <span className="text-[10px] font-black tracking-[0.35em] uppercase text-blue-400">
                  Trending now
                </span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-none">
                What renters love
              </h2>
            </div>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {[
              {
                title: 'Performance runners',
                sub: 'High-velocity comfort',
                badge: 'In stock',
                badgeClass: 'bg-blue-600',
                img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDoNcQkApu6lapQ3sZ8EFVVHxsrjxQNROGsXuCudiC-SEar7ybNAWXhalSALmF6NegLHem2-GzaglZGdnXAalJJ8pQiIroBIrH11Hdai-cpFNgLdwrjVr0NVjPeLjvm1hm8QRm3etbSa3rMfy9toIrHq4RQKIm9iT_FiBej13f_KFF638_-hCmJQWq81eO77aON1teeEzR_xOxiVGmwjBMHm4p56k2SNt4r0675RWAp2UJlcAOv7Rb61dyyQk_6c53TD5di28gTpg',
              },
              {
                title: 'Minimal sneakers',
                sub: 'Everyday essential',
                badge: 'Popular',
                badgeClass: 'bg-slate-600',
                img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAA1In5eGF1DGL4SZSyyvK8TpGl0F4NIufV1p9-xUQjshfBpRWHH-9Pn5RBzE39CAgLBw1HDBc950KAJwE479MGc3P0BUx5HZv6XuS51V1KyO8LWKkR4YlinEm8aokVLdLUIVXUKRcM4gDXHKzXd21QMxv_NocoAjg2dgawLcjM6QYNi7MyOK-Zlhpiod3inn-uZ7tFg3PPT_i7cqD9EVxcQIpXq9T40IjLZs_gD2Dp_Nbo37yNfSIwHMWkJ9Jy0ww-i4IVP7jXZw',
              },
              {
                title: 'Street archive',
                sub: 'Bold silhouettes',
                badge: 'New',
                badgeClass: 'bg-emerald-600',
                img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD05L3GFdqKvrT0xy4RA3BkstjLOT5uc72XFHNG27ipxEznA8vCKieNZk9qAYqyD7CWemupjBNiIrcgyZaAAEHuTIKoGNXRcBTnLrfceMmc5-BfHcQ96_82ydZXnrhDFfzhzeJai-hYAUFJM0TllMFzhsVoW_1Tv2XJRvvQqkuQ9Fd_CNFK8IeOofMCgBNIFcXCOUDOgm9gAO_PN5zRyadkpijDs7zIcj8mremUTY6wX8YHOy5xoWLRuWJfjMXY9ppo1ZKKF9FwiQ',
              },
            ].map((t) => (
              <Link
                key={t.title}
                to="/shoes"
                className="min-w-[min(100%,22rem)] sm:min-w-[24rem] bg-slate-800 rounded-2xl p-5 sm:p-6 flex items-center gap-5 group hover:bg-slate-700 transition-colors border border-slate-700/80"
              >
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-slate-900 shrink-0">
                  <img
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    alt=""
                    src={t.img}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold mb-1 truncate">{t.title}</h3>
                  <p className="text-sm text-slate-400 mb-3">{t.sub}</p>
                  <span
                    className={`text-xs ${t.badgeClass} text-white px-3 py-1 rounded-full font-bold inline-block`}
                  >
                    {t.badge}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-0">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase mb-3 text-slate-900 dark:text-white">
            Best value picks
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Premium feel, sensible daily rates—browse pairs our team recommends for maximum style per
            dollar.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          <Link
            to="/shoes"
            className="lg:col-span-2 lg:row-span-2 group relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 min-h-[20rem]"
          >
            <div className="absolute inset-0">
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                alt="Brown leather desert boots on a wooden surface"
                src="https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1600&q=80"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 text-white">
              <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block">
                Editor&apos;s choice
              </span>
              <h3 className="text-2xl sm:text-3xl font-black uppercase mb-2">Desert boot edit</h3>
              <p className="text-slate-300 mb-4 max-w-md text-sm">
                Soft suede and sturdy soles—ideal for long days when you still want to look sharp.
              </p>
              <span className="text-2xl font-black">From $45 / day</span>
            </div>
          </Link>
          <Link
            to="/shoes"
            className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 group hover:border-primary/50 transition-colors"
          >
            <div className="aspect-square rounded-xl overflow-hidden mb-5 bg-white dark:bg-slate-800">
              <img
                className="w-full h-full object-cover group-hover:rotate-3 transition-transform duration-500"
                alt="White canvas sneakers"
                src="https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=800&q=80"
              />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">
              Classic canvas
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Timeless street appeal</p>
            <div className="flex justify-between items-center">
              <span className="font-black text-primary">From $15 / day</span>
              <span className="material-symbols-outlined text-slate-400">add_circle</span>
            </div>
          </Link>
          <Link
            to="/shoes"
            className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 group hover:border-primary/50 transition-colors"
          >
            <div className="aspect-square rounded-xl overflow-hidden mb-5 bg-white dark:bg-slate-800">
              <img
                className="w-full h-full object-cover group-hover:-rotate-3 transition-transform duration-500"
                alt="Modern athletic running shoes"
                src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80"
              />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">
              Tech trainer
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Performance at scale</p>
            <div className="flex justify-between items-center">
              <span className="font-black text-primary">From $22 / day</span>
              <span className="material-symbols-outlined text-slate-400">add_circle</span>
            </div>
          </Link>
        </div>
      </section>

      {/* The Archive News — kept as requested */}
      <section className="py-16 sm:py-24 px-0 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-0">
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1" />
            <h2 className="text-xl sm:text-2xl font-black tracking-widest uppercase text-slate-400 dark:text-slate-500 whitespace-nowrap px-2">
              The Archive News
            </h2>
            <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-12">
            <article className="group">
              <div className="aspect-video overflow-hidden rounded-2xl mb-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoNcQkApu6lapQ3sZ8EFVVHxsrjxQNROGsXuCudiC-SEar7ybNAWXhalSALmF6NegLHem2-GzaglZGdnXAalJJ8pQiIroBIrH11Hdai-cpFNgLdwrjVr0NVjPeLjvm1hm8QRm3etbSa3rMfy9toIrHq4RQKIm9iT_FiBej13f_KFF638_-hCmJQWq81eO77aON1teeEzR_xOxiVGmwjBMHm4p56k2SNt4r0675RWAp2UJlcAOv7Rb61dyyQk_6c53TD5di28gTpg"
                />
              </div>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 block">
                Craftsmanship
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold mb-4 leading-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                The Art of the Oxford: A Masterclass in Tradition
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6 line-clamp-3">
                From historic streets to the modern boardroom—how the world&apos;s most formal
                footwear evolved, and how to style it for rentals today.
              </p>
              <Link
                to="/faq"
                className="font-bold text-xs uppercase tracking-widest border-b-2 border-primary pb-1 text-primary inline-block"
              >
                Read story
              </Link>
            </article>
            <article className="group">
              <div className="aspect-video overflow-hidden rounded-2xl mb-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIQlg3h7os9SzlEKGsB4L-zS8jStlaHJq4VLBXsXlnxnNuAljnEomlKBEFeUIgoUdb-qXmekBLhpV_QBzFamE8QKep9OrQ2ccJ1LMbKcEu3XpDOXyH00pcZ7HQxF5pIbJSqpZA2O07TJehSh6WD7s-HJFQqL7jL8bNNYRdqri4T9Iy2F5AANlNxF28MDgKrxfH3OO5g7GsHfw6bKCPniU-1mwG1elBBK41K-eSOIk8l5OMvMN0gB35WUvYnRVP06NbN20Yr1Jjeg"
                />
              </div>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 block">
                Seasonal guide
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold mb-4 leading-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                Summer Style: Breathable Luxury
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6 line-clamp-3">
                Don&apos;t sacrifice elegance when temperatures rise—linens, suedes, and perforated
                leathers worth renting this season.
              </p>
              <Link
                to="/how-it-works"
                className="font-bold text-xs uppercase tracking-widest border-b-2 border-primary pb-1 text-primary inline-block"
              >
                Read story
              </Link>
            </article>
            <article className="group">
              <div className="aspect-video overflow-hidden rounded-2xl mb-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjIVsHCeV5MkhpmR0g6jIXgxyILcEs7jyCyEgLPCY8jxb-0ThRkGcgqx_RYKhf9UkRJpyQCkPnJLPa1UQ6khAOktHlceYKTgzSIdkCzMMR8QFtYXYBA4_UVixWs7BFni41aVUvXJMW-2-gl6n6hzUFuy-c3Q4bqRKe5M8C5TzFDJ742ZjzI-wH1JDbLZZhi3l6XfZMD378KXiUE0bJDOz4z2Wlh-z4oDbsMz7BYvXN4i5T2ewKntBQVE-Z7CAnqmXRAdDYueFLVg"
                />
              </div>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 block">
                New drop
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold mb-4 leading-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                New Inventory: Performance &amp; Silhouette
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6 line-clamp-3">
                Our catalog grows with new pairs focused on high-performance materials and bold
                design—see what just landed in store.
              </p>
              <Link
                to="/shoes"
                className="font-bold text-xs uppercase tracking-widest border-b-2 border-primary pb-1 text-primary inline-block"
              >
                Browse collection
              </Link>
            </article>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-0 pt-10 flex justify-center">
        <Link
          to="/shoes"
          className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg hover:opacity-95 transition-opacity"
        >
          <span className="material-symbols-outlined text-xl">shopping_bag</span>
          Start renting
        </Link>
      </div>

    </div>
  )
}
