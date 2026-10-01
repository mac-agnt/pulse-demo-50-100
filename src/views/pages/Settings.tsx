import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";
import PeoplePanel from "./PeoplePanel";

type Props = { v: any };

export default function Settings({ v }: Props) {
  return (
    <>
      <div style={{"maxWidth":"1364px","padding":"0 22px 38px","animation":"pageIn .7s var(--ease) both"}}>
        <div style={{"display":"flex","alignItems":"flex-end","gap":"18px","flexWrap":"wrap","padding":"20px 4px 20px"}}>
          <div style={{"flex":"1","minWidth":"280px"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.16em","color":"var(--faint)"}}>
              {"ADMIN"}
            </div>
            <h1 style={{"margin":"8px 0 0","fontSize":"38px","fontWeight":"500","letterSpacing":"-1.5px","lineHeight":"1"}}>
              {"Settings"}
            </h1>
            <div style={{"fontSize":"14px","color":"var(--dim)","marginTop":"9px"}}>
              {"How Pulse is set up for "}
              {txt(v.admin?.company)}
              {" — people, permissions, systems and governance."}
            </div>
          </div>
          <button className="ix10" style={{"flex":"none","height":"36px","display":"flex","alignItems":"center","gap":"8px","padding":"0 15px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-ctl,13px)","fontSize":"13px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 8v4l3 1.8" />
            </svg>
            {"Change history"}
          </button>
        </div>
        <div style={{"display":"flex","flexWrap":"wrap","gap":"8px","padding":"0 4px 24px"}}>
          {arr(v.admin?.urgent).map((u: any, i73: number) => (
            <Fragment key={i73}>
              <button className="ixg" onClick={u?.go} style={css(cat("display:flex;align-items:center;gap:10px;height:38px;padding:0 15px;background:var(--chip);border:1px solid ", u?.border, ";border-radius:var(--r-ctl,13px);font-size:13px;color:var(--body);cursor:pointer;transition:border-color .2s var(--ease),transform .18s var(--ease)"))}>
                <span style={css(cat("width:7px;height:7px;flex:none;border-radius:2px;background:", u?.dot))} />
                <span style={css(cat("font-weight:500;color:", u?.dot))}>
                  {txt(u?.count)}
                </span>
                {txt(u?.label)}
              </button>
            </Fragment>
          ))}
        </div>
        <div style={{"display":"grid","gridTemplateColumns":"272px minmax(0,1fr)","gap":"20px","alignItems":"start"}}>
          <div style={{"display":"flex","flexDirection":"column","gap":"20px","position":"sticky","top":"0"}}>
            {arr(v.admin?.groups).map((grp: any, i74: number) => (
              <Fragment key={i74}>
                <div>
                  <div style={{"display":"flex","alignItems":"center","gap":"9px","padding":"7px 11px","marginBottom":"8px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-sm,11px)"}}>
                    <span style={{"width":"5px","height":"5px","flex":"none","borderRadius":"50%","background":"var(--accent)"}} />
                    <span style={{"flex":"1","minWidth":"0","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.16em","color":"var(--dim)"}}>
                      {txt(grp?.label)}
                    </span>
                    <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                      {txt(grp?.count)}
                    </span>
                  </div>
                  <div style={{"position":"relative","display":"flex","flexDirection":"column","gap":"3px"}}>
                    <span style={css(grp?.thumbStyle)} />
                    {arr(grp?.cards).map((c: any, i75: number) => (
                      <Fragment key={i75}>
                        <button onClick={c?.open} style={css(c?.navStyle)}>
                          <span style={css(c?.navIconWrap)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                              <path d={c?.icon} />
                            </svg>
                          </span>
                          <span style={{"flex":"1","minWidth":"0","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                            {txt(c?.title)}
                          </span>
                          {c?.hasBadge && (
                            <>
                              <span style={css(c?.navBadgeStyle)}>
                                {txt(c?.badge)}
                              </span>
                            </>
                          )}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
          <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px)","boxShadow":"var(--card-shadow)","overflow":"hidden","minHeight":"560px"}}>
            <div style={css(v.admin?.panelAnim)}>
              <div style={{"display":"flex","alignItems":"flex-start","gap":"12px","padding":"22px 24px 18px","borderBottom":"1px solid var(--border)"}}>
                <span style={css(cat("width:34px;height:34px;flex:none;border-radius:var(--r-md,12px);background:var(--chip);border:1px solid var(--chip-border);color:", v.admin?.panel?.tint, ";display:flex;align-items:center;justify-content:center"))}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={v.admin?.panel?.icon} />
                  </svg>
                </span>
                <div style={{"flex":"1","minWidth":"0"}}>
                  <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--faint)"}}>
                    {txt(v.admin?.panel?.group)}
                  </div>
                  <div style={{"fontSize":"20px","fontWeight":"500","letterSpacing":"-.5px","marginTop":"6px"}}>
                    {txt(v.admin?.panel?.title)}
                  </div>
                </div>
              </div>
              <div style={{"padding":"20px 24px 24px"}}>
                {v.admin?.panel?.isAppearance && (
                  <>
                    {arr(v.admin?.panel?.appearance?.groups).map((grp: any, i76: number) => (
                      <Fragment key={i76}>
                        <div style={{"marginBottom":"20px"}}>
                          <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--faint)","marginBottom":"10px"}}>
                            {txt(grp?.label)}
                          </div>
                          <div style={{"display":"grid","gridTemplateColumns":"1fr 1fr 1fr 1fr","gap":"10px"}}>
                            {arr(grp?.cards).map((t: any, i77: number) => (
                              <Fragment key={i77}>
                                <button onClick={t?.pick} style={css(t?.cardStyle)}>
                                  <div style={css(t?.mockStyle)}>
                                    <div style={css(t?.barStyle)} />
                                    <div style={css(t?.cardMockStyle)} />
                                    <div style={css(t?.dotStyle)} />
                                    <div style={css(t?.lineStyle)} />
                                  </div>
                                  <div style={{"display":"flex","alignItems":"center","gap":"6px","marginTop":"9px"}}>
                                    <span style={{"flex":"1","fontSize":"12.5px","fontWeight":"500"}}>
                                      {txt(t?.label)}
                                    </span>
                                    {t?.on && (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                      </>
                                    )}
                                  </div>
                                </button>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      </Fragment>
                    ))}
                  </>
                )}
                {v.admin?.panel?.isPeople && <PeoplePanel v={v} />}
                {v.admin?.panel?.isIntegrations && (
                  <>
                    <div style={{"display":"grid","gridTemplateColumns":"repeat(auto-fill,minmax(280px,1fr))","gap":"12px"}}>
                      {arr(v.admin?.panel?.integrations?.cards).map((it: any, i84: number) => (
                        <Fragment key={i84}>
                          <div className="ix14" style={{"background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--card-r,18px)","overflow":"hidden","transition":"border-color .22s var(--ease),transform .22s var(--ease)"}}>
                            <div style={css(it?.artStyle)}>
                              <span style={css(it?.meshStyle)} />
                              <span style={css(it?.pulseTileStyle)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 12h4l2.5-6 3.5 12 3-8 2 2h5" />
                                </svg>
                              </span>
                              <span style={css(it?.wireStyle)}>
                                <span style={css(it?.sparkStyle)} />
                              </span>
                              <span style={css(it?.appTileStyle)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                  <path d={it?.glyph} />
                                </svg>
                              </span>
                            </div>
                            <div style={{"padding":"15px 16px 16px"}}>
                              <div style={{"display":"flex","alignItems":"center","gap":"9px"}}>
                                <span style={{"flex":"1","minWidth":"0","fontSize":"15px","fontWeight":"600","letterSpacing":"-.25px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                  {txt(it?.pairTitle)}
                                </span>
                                <span style={css(it?.statusStyle)}>
                                  {txt(it?.status)}
                                </span>
                              </div>
                              <div style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)","marginTop":"5px"}}>
                                {txt(it?.lastSync)}
                              </div>
                              <div style={{"fontSize":"12.5px","color":"var(--dim)","lineHeight":"1.5","marginTop":"9px","textWrap":"pretty"}}>
                                {txt(it?.blurb)}
                              </div>
                              <div style={{"display":"flex","flexWrap":"wrap","gap":"6px","marginTop":"11px"}}>
                                <span style={{"padding":"3px 9px","borderRadius":"var(--chip-r,8px)","background":"var(--surface-2)","border":"1px solid var(--border)","fontSize":"10.5px","color":"var(--faint)"}}>
                                  {txt(it?.auth)}
                                </span>
                                {arr(it?.scopes).map((sc: any, i85: number) => (
                                  <Fragment key={i85}>
                                    <span style={{"padding":"3px 9px","borderRadius":"var(--chip-r,8px)","background":"var(--surface-2)","border":"1px solid var(--border)","fontSize":"10.5px","color":"var(--dim)"}}>
                                      {txt(sc?.label)}
                                    </span>
                                  </Fragment>
                                ))}
                              </div>
                              <div style={{"display":"flex","alignItems":"center","gap":"10px","marginTop":"14px","paddingTop":"13px","borderTop":"1px solid var(--border)"}}>
                                <button className="ixz" style={css(it?.actionStyle)}>
                                  {txt(it?.actionLabel)}
                                </button>
                                <span style={{"flex":"1","minWidth":"0","fontSize":"11px","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                  {txt(it?.usage)}
                                </span>
                                <button onClick={it?.toggle} title="Enable or pause" style={css(it?.toggleTrackStyle)}>
                                  <span style={css(it?.toggleKnobStyle)} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
                {v.admin?.panel?.isDataHealth && (
                  <>
                    <div style={{"padding":"16px 18px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--card-r,18px)","marginBottom":"14px"}}>
                      <div style={{"fontSize":"12.5px","color":"var(--dim)"}}>
                        {txt(v.admin?.panel?.health?.summary)}
                      </div>
                      <div style={{"display":"flex","alignItems":"flex-end","gap":"6px","height":"64px","marginTop":"14px"}}>
                        {arr(v.admin?.panel?.health?.bars).map((b: any, i86: number) => (
                          <Fragment key={i86}>
                            <div style={{"flex":"1","display":"flex","flexDirection":"column","alignItems":"center","gap":"5px","height":"100%","justifyContent":"flex-end"}}>
                              <div style={css(cat("width:100%;border-radius:3px;height:", b?.h, ";background:", b?.bg, ";transform-origin:bottom;animation:growBar .5s var(--ease) both"))} />
                            </div>
                          </Fragment>
                        ))}
                      </div>
                      <div style={{"display":"flex","gap":"8px","marginTop":"14px"}}>
                        {arr(v.admin?.panel?.health?.severity).map((s: any, i87: number) => (
                          <Fragment key={i87}>
                            <div style={{"flex":"1","padding":"10px 12px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-sm,11px)"}}>
                              <div style={{"display":"flex","alignItems":"center","gap":"6px"}}>
                                <span style={css(cat("width:6px;height:6px;border-radius:2px;background:", s?.bg))} />
                                <span style={{"fontSize":"10.5px","color":"var(--faint)"}}>
                                  {txt(s?.label)}
                                </span>
                              </div>
                              <div style={{"fontFamily":"var(--mono)","fontSize":"16px","marginTop":"5px"}}>
                                {txt(s?.count)}
                                <span style={{"fontSize":"10.5px","color":"var(--faint)","marginLeft":"4px"}}>
                                  {txt(s?.pct)}
                                </span>
                              </div>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {v.admin?.panel?.hasIssues && (
                  <>
                    <div style={{"display":"flex","flexDirection":"column","gap":"9px"}}>
                      {arr(v.admin?.panel?.issues).map((is: any, i88: number) => (
                        <Fragment key={i88}>
                          <div style={{"padding":"14px 16px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-sm,9px)"}}>
                            <div style={{"display":"flex","alignItems":"center","gap":"9px"}}>
                              <span style={css(cat("width:8px;height:8px;border-radius:2px;background:", is?.dot))} />
                              <span style={{"flex":"1","minWidth":"0","fontSize":"13.5px","fontWeight":"500","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                {txt(is?.title)}
                              </span>
                              <span style={{"fontFamily":"var(--mono)","fontSize":"13px","color":"var(--ink)"}}>
                                {txt(is?.count)}
                              </span>
                            </div>
                            <div style={{"fontSize":"12px","color":"var(--dim)","lineHeight":"1.5","marginTop":"7px"}}>
                              {txt(is?.fix)}
                            </div>
                            <button style={{"height":"28px","marginTop":"9px","padding":"0 12px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"11.5px","color":"var(--body)","cursor":"pointer"}}>
                              {txt(is?.action)}
                            </button>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
                {v.admin?.panel?.hasHero && (
                  <>
                    <div style={{"marginTop":"16px","padding":"16px 18px","background":"var(--accent-faint)","border":"1px solid var(--accent-line)","borderRadius":"var(--card-r,18px)"}}>
                      <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--accent)"}}>
                        {txt(v.admin?.panel?.heroLabel)}
                      </div>
                      <div style={{"fontSize":"14px","lineHeight":"1.55","color":"var(--ink)","marginTop":"7px"}}>
                        {txt(v.admin?.panel?.heroText)}
                      </div>
                      <button className="ix15" style={{"height":"34px","marginTop":"13px","padding":"0 15px","border":"1px solid var(--accent)","background":"none","borderRadius":"var(--r-ctl,9px)","fontSize":"13px","color":"var(--accent)","cursor":"pointer","transition":"background .2s var(--ease)"}}>
                        {txt(v.admin?.panel?.heroAction)}
                      </button>
                    </div>
                  </>
                )}
                {v.admin?.panel?.showGenericRows && (
                  <>
                    <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--faint)","marginTop":"24px"}}>
                      {txt(v.admin?.panel?.listLabel)}
                    </div>
                    <div style={{"marginTop":"12px"}}>
                      {arr(v.admin?.panel?.rows).map((r: any, i89: number) => (
                        <Fragment key={i89}>
                          <div style={{"display":"flex","alignItems":"center","gap":"14px","padding":"13px 0","borderTop":"1px solid var(--border)"}}>
                            <div style={{"flex":"1","minWidth":"0"}}>
                              <div style={{"fontSize":"13.5px","lineHeight":"1.4"}}>
                                {txt(r?.label)}
                              </div>
                              {r?.hasNote && (
                                <>
                                  <div style={{"fontSize":"11.5px","color":"var(--faint)","marginTop":"4px"}}>
                                    {txt(r?.note)}
                                  </div>
                                </>
                              )}
                            </div>
                            {r?.isValue && (
                              <>
                                <span style={{"flex":"none","fontSize":"12.5px","color":"var(--dim)","whiteSpace":"nowrap"}}>
                                  {txt(r?.value)}
                                </span>
                              </>
                            )}
                            {r?.isToggle && (
                              <>
                                <button onClick={r?.toggle} style={css(cat("width:38px;height:22px;flex:none;border:0;border-radius:8px;background:", r?.trackBg, ";cursor:pointer;padding:0;position:relative;transition:background .22s var(--ease)"))}>
                                  <span style={css(cat("position:absolute;top:3px;left:", r?.knobLeft, ";width:16px;height:16px;border-radius:6px;background:", r?.knobBg, ";transition:left .24s var(--ease)"))} />
                                </button>
                              </>
                            )}
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"16px 24px","borderTop":"1px solid var(--border)"}}>
                <span style={{"flex":"1","minWidth":"0","fontSize":"12px","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                  {txt(v.admin?.panel?.audit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
