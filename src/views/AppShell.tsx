import { Fragment } from "react";
import { arr, cat, css, cx, txt } from "../runtime/template";
import AgentFace from "../components/AgentFace";
import NavThumb from "../components/NavThumb";
import DashboardKpiBand from "./pages/DashboardKpiBand";
import Home from "./pages/Home";
import Work from "./pages/Work";
import Records from "./pages/Records";
import RecordsFiles from "./pages/RecordsFiles";
import RecordsOntology from "./pages/RecordsOntology";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import HeliosMini from "./overlays/HeliosMini";
import AgentStudio from "./overlays/AgentStudio";
import CommandPalette from "./overlays/CommandPalette";
import BackgroundGallery from "./overlays/BackgroundGallery";
import { BrandMark, BrandName, ScopeNotice, ViewerCard, ViewerChip } from "../ui/shell";
import { ModuleSwitch, PageSwitch, ScopeSwitch } from "../ui/topnav";

const ScopeSwitchSlot = ({ hidden }: { hidden: boolean }) => (hidden ? null : <ScopeSwitch />);
import { CoreToast } from "../ui/kit";
import ContactsView from "../ui/records/ContactsView";
import RecordsBrowse from "../ui/records/RecordsBrowse";
import RecordsQuality from "../ui/records/RecordsQuality";

type Props = { v: any };

export default function AppShell({ v }: Props) {
  return (
    <>
    <div data-theme={v.theme} style={{"fontFamily":"var(--ui)","position":"relative","display":"flex","height":"100vh","overflow":"hidden","background":"var(--bg)","color":"var(--ink)",...v.rootVars}}>
      <div style={{"position":"absolute","width":"1px","height":"1px","overflow":"hidden","opacity":"0","pointerEvents":"none"}}>
        <AgentFace shape={"crown-pebble"} state={"idle"} tint={"#191c1f"} size={"1"} />
      </div>
      <nav data-rail-nav="1" style={css(v.railOuter)}>
        <span style={css(v.railThumbStyle)} />
        <div style={css(cat(v.railRowStyle, "margin-bottom:22px"))}>
          <button className={cx("ix0", "ix1")} onClick={v.toggleRail} title={v.railLabel} style={{"width":"36px","height":"36px","flex":"none","border":"0","borderRadius":"var(--cta-r,11px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","fontSize":"13px","fontWeight":"600","padding":"0","transition":"transform .2s var(--ease)"}}>
            <BrandMark />
          </button>
          <span style={css(v.brandStyle)}>
            <span style={{"display":"block","fontSize":"13.5px","fontWeight":"600","letterSpacing":"-.2px","color":"var(--ink)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
              <BrandName />
            </span>
            <span style={{"display":"block","marginTop":"2px","fontSize":"9px","fontWeight":"500","letterSpacing":".16em","color":"var(--accent)"}}>
              {"PULSE"}
            </span>
          </span>
          {v.railOpen && (
            <>
              <button className="ix2" onClick={v.toggleRail} title={v.railLabel} style={{"width":"28px","height":"28px","flex":"none","border":"0","borderRadius":"var(--r-ctl,10px)","background":"none","color":"var(--mid)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"background .2s var(--ease),color .2s var(--ease)"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16 M4 12h10 M4 18h16" />
                </svg>
              </button>
            </>
          )}
        </div>
        {arr(v.nav).map((item: any, i0: number) => (
          <Fragment key={i0}>
            {item?.isDivider && (
              <>
                <div style={{"width":"20px","height":"1px","background":"var(--track)","margin":"7px 0"}} />
              </>
            )}
            {item?.isItem && (
              <>
                <button className="ix3" data-rail={item?.railKey} onClick={item?.go} onPointerEnter={item?.enter} onPointerLeave={item?.leave} style={css(item?.style)}>
                  <span style={{"position":"relative","flex":"none","width":"17px","height":"17px","display":"flex","alignItems":"center","justifyContent":"center"}}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={css(item?.glyphStyle)}>
                      <path d={item?.d} />
                    </svg>
                  </span>
                  {item?.dot && (
                    <>
                      <span style={css(item?.dotStyle)} />
                    </>
                  )}
                  <span style={css(item?.inlineStyle)}>
                    {txt(item?.label)}
                  </span>
                  {item?.hint && (
                    <>
                      <span style={css(item?.hintStyle)}>
                        {txt(item?.hint)}
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </Fragment>
        ))}
        <div style={{"flex":"1","minHeight":"10px"}} />
        {v.railOpen && (
          <>
            <ViewerCard open />
            <div style={{"margin":"4px 4px 4px","padding":"6px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"18px"}}>
              <button className="ix4" onClick={v.goSettings} onPointerEnter={v.setBtnIn} onPointerLeave={v.setBtnOut} style={{"position":"relative","width":"100%","height":"46px","marginTop":"16px","display":"flex","alignItems":"center","gap":"10px","padding":"0 5px 0 16px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"999px","color":"var(--ink)","fontSize":"14px","fontWeight":"600","letterSpacing":"-.1px","cursor":"pointer","overflow":"hidden","isolation":"isolate","boxShadow":"0 1px 0 rgba(255,255,255,.05) inset,0 2px 8px rgba(0,0,0,.18)","transition":"border-color .4s var(--ease)"}}>
                <span style={css(v.setDotStyle)} />
                <span style={css(v.setSheen)} />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" style={css(v.setIconStyle)}>
                  <path d="M5.5 4v16 M12 4v16 M18.5 4v16" opacity=".45" />
                  <path d="M3 12.5h5" style={css(v.setKnobA)} />
                  <path d="M9.5 5.5h5" style={css(v.setKnobB)} />
                  <path d="M16 14h5" style={css(v.setKnobC)} />
                </svg>
                <span style={{"position":"relative","zIndex":"2","flex":"1","textAlign":"left"}}>
                  {"Settings"}
                </span>
                <span style={{"position":"relative","zIndex":"2","flex":"none","width":"36px","height":"36px","borderRadius":"999px","overflow":"hidden","color":"var(--accent)"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={css(v.setArrowA)}>
                    <path d="M5 12h14 M13 6l6 6-6 6" />
                  </svg>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={css(v.setArrowB)}>
                    <path d="M5 12h14 M13 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            </div>
          </>
        )}
        {v.railShut && (
          <>
            <button className="ix5" onClick={v.goSettings} onPointerEnter={v.enterSettings} onPointerLeave={v.leaveSettings} style={css(v.settingsStyle)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={css(v.settingsGlyphStyle)}>
                <path d="M5.5 20v-5.5 M5.5 9.5V4 M12 20v-7.5 M12 7.5V4 M18.5 20v-4 M18.5 11V4 M3 12.5h5 M9.5 5.5h5 M16 14h5" />
              </svg>
              <span style={css(v.settingsInlineStyle)}>
                {"Settings"}
              </span>
            </button>
            <ViewerCard open={false} />
          </>
        )}
      </nav>
      <span style={css(v.hoverLabel?.style)}>
        <span style={{"position":"absolute","left":"-4px","top":"50%","width":"8px","height":"8px","background":"var(--tooltip)","borderLeft":"1px solid var(--border)","borderBottom":"1px solid var(--border)","transform":"translateY(-50%) rotate(45deg)"}} />
        <span style={{"width":"5px","height":"5px","borderRadius":"50%","background":"var(--accent)"}} />
        {txt(v.hoverLabel?.label)}
        <span style={{"opacity":".6"}}>
          {txt(v.hoverLabel?.hint)}
        </span>
      </span>
      <main className="pk-main" style={css(cat("--page-dy:", v.pageDy, ";position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;margin:16px 16px 16px 0;background:var(--panel,#0f1316);border:1px solid var(--border);border-radius:28px;overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,.03) inset"))}>
        {"\n"}
        {txt(v.pageSweepEl)}
        {"\n"}
        {v.showRecordsWash && (
          <>
            <div style={{"position":"absolute","left":"0","top":"0","right":"0","height":"660px","zIndex":"0","pointerEvents":"none","background":"var(--hero-grad)","WebkitMaskImage":"linear-gradient(180deg,rgba(0,0,0,.82) 0%,#000 18%,#000 72%,rgba(0,0,0,0) 100%)","maskImage":"linear-gradient(180deg,rgba(0,0,0,.82) 0%,#000 18%,#000 72%,rgba(0,0,0,0) 100%)"}} />
          </>
        )}
        <div style={{"position":"absolute","left":"0","right":"0","bottom":"0","height":"64px","zIndex":"3","pointerEvents":"none","maskImage":"linear-gradient(0deg,#000 0%,transparent 100%)","WebkitMaskImage":"linear-gradient(0deg,#000 0%,transparent 100%)","background":"linear-gradient(0deg,var(--bg) 0%,rgba(0,0,0,0) 100%)","opacity":".85"}} />
        <div style={css(v.headerFieldStyle)} />
        <header className="pk-header" style={{"position":"relative","zIndex":"4","flex":"none","width":"100%","padding":"18px 28px","boxSizing":"border-box","borderBottom":"1px solid var(--border)"}}>
          <div style={css(v.headerPillStyle)}>
            <ScopeSwitchSlot hidden={!!v.isSettings} />
            <ModuleSwitch current={v.page} />
            {!v.pagesAsTabs && <PageSwitch module={v.page} tabs={v.contextNav || []} asTabs={false} toggleTabs={v.togglePagesAsTabs} />}
            {v.pagesAsTabs && v.showPillNav && (
              <>
                <div style={css(v.navGroupStyle)}>
                  {v.tabsLoose && (
                    <>
                      <NavThumb style={v.navThumb} tabsKey={v.navThumbKey} />
                    </>
                  )}
                  {arr(v.contextNav).map((t: any, i1: number) => (
                    <Fragment key={i1}>
                      {t?.active && (
                        <>
                          <button onClick={t?.go} data-nav-active="1" style={css(cat("position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:", v.tabPad, ";border:0;border-radius:999px;cursor:pointer;font-size:13.5px;white-space:nowrap;background:", v.tabActiveBg, ";color:var(--ink);font-weight:600;transition:color .3s var(--ease)"))}>
                            {txt(t?.label)}
                            {t?.showCount && (
                              <>
                                <span style={{"position":"relative","padding":"1px 7px","borderRadius":"999px","background":"var(--accent-soft)","fontFamily":"var(--mono)","fontSize":"11px","color":"var(--accent)"}}>
                                  {txt(t?.count)}
                                </span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                      {t?.inactive && (
                        <>
                          <button className="ix3" onClick={t?.go} style={css(cat("position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:", v.tabPad, ";border:0;border-radius:999px;cursor:pointer;font-size:13.5px;white-space:nowrap;background:none;color:var(--dim);font-weight:500;transition:color .3s var(--ease)"))}>
                            {txt(t?.label)}
                            {t?.showCount && (
                              <>
                                <span style={{"padding":"1px 7px","borderRadius":"999px","minHeight":"15px","background":"var(--track)","fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
                                  {txt(t?.count)}
                                </span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </Fragment>
                  ))}
                </div>
              </>
            )}
            {v.pagesAsTabs && v.showPillNav && (v.contextNav || []).length > 0 && <button type="button" className="tn-btn tn-btn--page" title="Show pages as a menu" aria-label="Show pages as a menu" onClick={v.togglePagesAsTabs}>{"Pages as menu"}</button>}
            <div style={css(cat("flex:", v.searchWrapFlex, ";min-width:42px;display:flex;align-items:center;justify-content:center;padding:0 6px"))}>
              <button className="ix7" onClick={v.openPalette} title={v.searchHint} style={css(v.searchBarStyle)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{"flex":"none"}}>
                  <path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" />
                </svg>
                {v.searchExpanded && (
                  <>
                    <span style={{"flex":"1","minWidth":"0","textAlign":"left","fontSize":"13px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                      {txt(v.searchHint)}
                    </span>
                    <span style={{"flex":"none","height":"28px","padding":"0 10px","display":"flex","alignItems":"center","background":"var(--surface-2)","borderRadius":"999px","fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)"}}>
                      {"⌘K"}
                    </span>
                  </>
                )}
              </button>
            </div>
            {v.showHint && (
              <>
                <span style={{"flex":"0 1 auto","minWidth":"0","padding":"0 12px","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.11em","color":"var(--faint)","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                  {txt(v.contextHint)}
                </span>
              </>
            )}
            {v.barOpen && (
              <>
                <div style={{"width":"1px","height":"18px","flex":"none","margin":"0 4px","background":"var(--border)"}} />
                <div style={{"flex":"0 0 auto","display":"flex","alignItems":"center","gap":"2px","padding":"0 3px"}}>
                  {v.showTheme && (
                    <>
                      <button className="ix2" onClick={v.toggleTheme} title={v.themeLabel} style={{"width":"42px","height":"42px","border":"0","borderRadius":"999px","background":"none","cursor":"pointer","color":"var(--dim)","display":"flex","alignItems":"center","justifyContent":"center","transition":"background .2s var(--ease),color .2s var(--ease)"}}>
                        <span style={{"position":"relative","width":"17px","height":"17px","flex":"none","display":"block"}}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={css(v.sunStyle)}>
                            <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
                            <path d="M12 3.4v2.1 M12 18.5v2.1 M3.4 12h2.1 M18.5 12h2.1 M6.1 6.1l1.5 1.5 M16.4 16.4l1.5 1.5 M6.1 17.9l1.5-1.5 M16.4 7.6l1.5-1.5" />
                          </svg>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={css(v.moonStyle)}>
                            <path d="M20.4 14.8A8.6 8.6 0 0 1 9.2 3.6 8.7 8.7 0 1 0 20.4 14.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="16.9" cy="5.4" r="1" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".7" />
                            <circle cx="20.2" cy="9.2" r=".7" fill="currentColor" opacity=".4" />
                          </svg>
                        </span>
                      </button>
                    </>
                  )}
                  <button className="ix2" onClick={v.toggleNotifs} style={{"position":"relative","width":"42px","height":"42px","border":"0","borderRadius":"999px","background":"none","cursor":"pointer","color":"var(--dim)","display":"flex","alignItems":"center","justifyContent":"center","transition":"background .2s var(--ease),color .2s var(--ease)"}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.6 8.5 2.6 8.5H3.4S6 15 6 8.5Z M10.3 20.5a1.94 1.94 0 0 0 3.4 0" />
                    </svg>
                    {v.inboxCount !== "0" && <span style={{"position":"absolute","top":"9px","right":"10px","width":"8px","height":"8px","borderRadius":"999px","background":"var(--warn)","boxShadow":"0 0 0 2px var(--surface-2)"}}  />}
                  </button>
                </div>
                {v.showTeam && (
                  <>
                    <div style={{"width":"1px","height":"18px","flex":"none","margin":"0 4px","background":"var(--border)"}} />
                    <ViewerChip showText={!!v.showProfileText} />
                  </>
                )}
              </>
            )}
            <button className="ix2" onClick={v.toggleBar} title={v.barLabel} style={{"flex":"none","width":"42px","height":"42px","border":"0","borderRadius":"999px","background":"none","color":"var(--faint)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"background .2s var(--ease),color .2s var(--ease)"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css(v.barChevronStyle)}>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </header>
        <ScopeNotice />
        {v.showNotifs && (
          <>
            <div onClick={v.closeNotifs} style={{"position":"fixed","inset":"0","zIndex":"58","background":"rgba(0,0,0,.28)","backdropFilter":"blur(3px)","animation":"notifScrim .4s var(--ease) both"}} />
            <div style={{"position":"fixed","top":"60px","right":"22px","zIndex":"59","width":"min(390px,88vw)","transformOrigin":"calc(100% - 26px) -6px","animation":"notifPanel .58s cubic-bezier(.16,1,.28,1) both"}}>
              <span style={{"position":"absolute","top":"-34px","right":"6px","width":"180px","height":"120px","pointerEvents":"none","background":"radial-gradient(closest-side,var(--accent-soft),transparent 72%)","opacity":".9","animation":"notifHalo .7s var(--ease) both"}} />
              <div style={{"position":"relative","padding":"10px","background":"var(--overlay)","border":"1px solid var(--border-strong)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(44px) saturate(1.5)","boxShadow":"0 34px 90px rgba(0,0,0,.6),inset 0 1px 0 var(--glass-highlight)","overflow":"hidden"}}>
                <span style={{"position":"absolute","inset":"0","pointerEvents":"none","background":"linear-gradient(180deg,rgba(255,255,255,.05),transparent 42%)"}} />
                <div style={{"position":"relative","display":"flex","alignItems":"center","gap":"9px","padding":"6px 6px 11px","animation":"notifRow .44s cubic-bezier(.16,1,.3,1) 60ms both"}}>
                  <span style={{"fontSize":"14px","fontWeight":"600","letterSpacing":"-.2px","flex":"1"}}>
                    {"Notifications"}
                  </span>
                  <span style={{"display":"flex","alignItems":"center","gap":"6px","height":"22px","padding":"0 9px","borderRadius":"8px","background":"var(--accent-faint)","border":"1px solid var(--accent-line)"}}>
                    <span style={{"width":"5px","height":"5px","borderRadius":"50%","background":"var(--accent)","animation":"breathe 1.8s ease-in-out infinite"}} />
                    <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.1em","color":"var(--accent)"}}>
                      {txt(v.inboxCount)}
                      {" OPEN"}
                    </span>
                  </span>
                </div>
                <div style={{"position":"relative","display":"flex","flexDirection":"column","gap":"7px","maxHeight":"min(58vh,440px)","overflowY":"auto","scrollbarWidth":"none"}}>
                  {arr(v.notifications).map((n: any, i3: number) => (
                    <Fragment key={i3}>
                      <div className="ix9" role="button" tabIndex={0} onClick={n?.open} onKeyDown={(e) => { if (e.key === "Enter") n?.open?.(); }} style={css(n?.cardStyle)}>
                        <span style={css(n?.washStyle)} />
                        <span style={css(n?.dotStyle)} />
                        <span style={{"position":"relative","flex":"1","minWidth":"0","display":"block"}}>
                          <span style={{"display":"block","fontSize":"13px","lineHeight":"1.45","color":"var(--ink)","textWrap":"pretty"}}>
                            {txt(n?.text)}
                          </span>
                          <span style={{"display":"flex","alignItems":"center","gap":"7px","marginTop":"5px","minWidth":"0"}}>
                            <span style={{"flex":"none","fontSize":"11px","color":"var(--dim)"}}>
                              {txt(n?.when)}
                            </span>
                            <span style={{"flex":"none","width":"3px","height":"3px","borderRadius":"2px","background":"var(--track)"}} />
                            <span style={{"flex":"1","minWidth":"0","fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                              {txt(n?.event)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
                <div style={{"position":"relative","display":"flex","alignItems":"center","gap":"9px","padding":"11px 6px 4px","animation":"notifRow .44s cubic-bezier(.16,1,.3,1) 420ms both"}}>
                  <span style={{"flex":"1","minWidth":"0","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.1em","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                    {"EVERY EVENT IS WRITTEN TO THE AUDIT LOG"}
                  </span>
                  <button className="ixa" onClick={v.closeNotifs} style={{"flex":"none","height":"28px","padding":"0 13px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,10px)","background":"var(--surface-2)","color":"var(--body)","fontSize":"12px","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
                    {"Close"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        {v.isDashboard && <DashboardKpiBand v={v} />}
        <div data-scroll-main="1" style={{"flex":"1","minHeight":"0","overflowY":"auto","overflowX":"hidden","scrollbarWidth":"none"}}>
          {v.isChat && <Home v={v} />}
          {v.isWork && <Work v={v} />}
          {v.isRecords && <Records v={v} />}
          {v.rec?.isContacts && <ContactsView v={v} />}
          {v.rec?.isFiles && <RecordsFiles v={v} />}
          {v.rec?.isOntology && <RecordsOntology v={v} />}
          {v.rec?.isBrowse && <RecordsBrowse v={v} />}
          {v.rec?.isQuality && <RecordsQuality v={v} />}
          {v.isActivity && <Activity v={v} />}
          {v.isSettings && <Settings v={v} />}
          {v.isDashboard && <Dashboard v={v} />}
          {v.isAgents && <Agents v={v} />}
        </div>
      </main>
      {v.showFab && (
        <>
          <button className={cx("ix18", "ixo")} onClick={v.toggleMini} title={v.fabTitle} style={{"position":"fixed","right":"26px","bottom":"26px","zIndex":"47","width":"56px","height":"56px","border":"1px solid var(--accent-line)","borderRadius":"var(--cta-r,14px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"0 14px 34px rgba(0,0,0,.34)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"transform .3s var(--ease),box-shadow .3s var(--ease)"}}>
            <span style={{"position":"relative","width":"24px","height":"24px","flex":"none"}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={css(v.fabChatStyle)}>
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4-.8L3 21l1.9-4.9A8.3 8.3 0 0 1 4 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z M8 12h1.6l1.2-2.6 1.6 5 1.4-2.4H16" />
              </svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={css(v.fabCloseStyle)}>
                <path d="M7 7l10 10 M17 7 7 17" />
              </svg>
            </span>
          </button>
        </>
      )}
      {v.miniOpen && <HeliosMini v={v} />}
      {v.builderOpen && <AgentStudio v={v} />}
      {v.paletteOpen && <CommandPalette v={v} />}
      {v.bgGallery?.open && <BackgroundGallery v={v} />}
      <CoreToast />
    </div>
    </>
  );
}
