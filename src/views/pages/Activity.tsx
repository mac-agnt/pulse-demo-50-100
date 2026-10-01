import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";
import AgentFace from "../../components/AgentFace";

type Props = { v: any };

export default function Activity({ v }: Props) {
  return (
    <>
      <div style={{"width":"100%","maxWidth":"1280px","margin":"0 auto","boxSizing":"border-box","padding":"22px 32px 40px","animation":"pageIn .7s var(--ease) both"}}>
        <div style={{"display":"flex","alignItems":"flex-end","gap":"18px","flexWrap":"wrap","padding":"20px 4px 20px"}}>
          <div style={{"flex":"1","minWidth":"280px"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.16em","color":"var(--faint)"}}>
              {txt(v.act?.eyebrow)}
            </div>
            <h1 style={{"margin":"8px 0 0","fontSize":"38px","fontWeight":"500","letterSpacing":"-1.5px","lineHeight":"1"}}>
              {txt(v.act?.heading)}
            </h1>
            <div style={{"fontSize":"14px","color":"var(--dim)","marginTop":"9px","maxWidth":"70ch","textWrap":"pretty"}}>
              {txt(v.act?.subhead)}
            </div>
          </div>
          <div style={{"display":"flex","gap":"8px"}}>
            <button onClick={v.act?.togglePause} style={css(v.act?.pauseStyle)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d={v.act?.pauseIcon} />
              </svg>
              {txt(v.act?.pauseLabel)}
            </button>
            <button className="ix10" style={{"height":"36px","display":"flex","alignItems":"center","gap":"8px","padding":"0 15px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-ctl,9px)","fontSize":"13px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.5v11 M7.5 10 12 14.5 16.5 10 M4.5 19.5h15" />
              </svg>
              {"Export audit log"}
            </button>
          </div>
        </div>
        {v.act?.agentLens && (
          <>
            <div style={{"display":"grid","gridTemplateColumns":"repeat(4,minmax(0,1fr))","gap":"12px"}}>
              {arr(v.act?.agentKpis).map((k: any, i57: number) => (
                <Fragment key={i57}>
                  <div style={css(k?.style)}>
                    <div style={{"display":"flex","alignItems":"center","gap":"8px"}}>
                      <span style={css(cat("width:7px;height:7px;border-radius:2px;background:", k?.dot))} />
                      <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(k?.label)}
                      </span>
                    </div>
                    <div style={css(cat("font-family:var(--mono);font-size:28px;font-weight:var(--fig-weight,inherit);letter-spacing:-1px;margin-top:10px;color:", k?.valueColor))}>
                      {txt(k?.value)}
                    </div>
                    <div style={{"fontSize":"11.5px","color":"var(--faint)","marginTop":"6px"}}>
                      {txt(k?.hint)}
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
            <div style={{"display":"flex","alignItems":"center","gap":"10px","marginTop":"22px","padding":"0 4px"}}>
              <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.14em","color":"var(--faint)"}}>
                {"THE ROSTER"}
              </span>
              <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
            </div>
            <div style={{"display":"grid","gridTemplateColumns":"repeat(auto-fill,minmax(300px,1fr))","gap":"9px","marginTop":"11px"}}>
              {arr(v.act?.roster).map((a: any, i58: number) => (
                <Fragment key={i58}>
                  <button className="ixr" onClick={a?.go} style={css(a?.style)}>
                    <div style={{"display":"flex","alignItems":"center","gap":"11px","width":"100%","minWidth":"0"}}>
                      <AgentFace shape={a?.shape} state={a?.state} tint={a?.tint} size={"34"} />
                      <span style={{"flex":"1","minWidth":"0","display":"block"}}>
                        <span style={{"display":"flex","alignItems":"center","gap":"7px","minWidth":"0"}}>
                          <span style={{"flex":"none","fontSize":"13.5px","fontWeight":"600","letterSpacing":"-.15px","color":"var(--ink)"}}>
                            {txt(a?.name)}
                          </span>
                          <span style={css(a?.dotStyle)} />
                          <span style={css(a?.stateStyle)}>
                            {txt(a?.stateLabel)}
                          </span>
                        </span>
                        <span style={{"display":"block","fontSize":"11.5px","color":"var(--dim)","marginTop":"3px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                          {txt(a?.preview)}
                        </span>
                      </span>
                      <span style={{"flex":"none","textAlign":"right"}}>
                        <span style={{"display":"block","fontFamily":"var(--mono)","fontSize":"17px","fontWeight":"var(--fig-weight,inherit)","letterSpacing":"-.5px","color":"var(--ink)"}}>
                          {txt(a?.actions)}
                        </span>
                        <span style={{"display":"block","fontFamily":"var(--mono)","fontSize":"8.5px","letterSpacing":"0.1em","color":"var(--faint)","marginTop":"1px"}}>
                          {"ACTIONS"}
                        </span>
                      </span>
                    </div>
                    <div style={{"width":"100%","height":"2px","borderRadius":"2px","background":"var(--track)","overflow":"hidden"}}>
                      <div style={css(a?.barStyle)} />
                    </div>
                  </button>
                </Fragment>
              ))}
            </div>
          </>
        )}
        {v.act?.peopleLens && (
          <>
            <div style={{"display":"grid","gridTemplateColumns":"repeat(4,minmax(0,1fr))","gap":"12px"}}>
              {arr(v.act?.peopleKpis).map((k: any, i59: number) => (
                <Fragment key={i59}>
                  <div style={css(k?.style)}>
                    <div style={{"display":"flex","alignItems":"center","gap":"8px"}}>
                      <span style={css(cat("width:7px;height:7px;border-radius:2px;background:", k?.dot))} />
                      <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(k?.label)}
                      </span>
                    </div>
                    <div style={css(cat("font-family:var(--mono);font-size:28px;font-weight:var(--fig-weight,inherit);letter-spacing:-1px;margin-top:10px;color:", k?.valueColor))}>
                      {txt(k?.value)}
                    </div>
                    <div style={{"fontSize":"11.5px","color":"var(--faint)","marginTop":"6px"}}>
                      {txt(k?.hint)}
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
            <div style={{"display":"flex","alignItems":"center","gap":"10px","marginTop":"22px","padding":"0 4px"}}>
              <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.14em","color":"var(--faint)"}}>
                {"THE TEAM TODAY"}
              </span>
              <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
            </div>
            <div style={{"display":"grid","gridTemplateColumns":"repeat(auto-fill,minmax(300px,1fr))","gap":"9px","marginTop":"11px"}}>
              {arr(v.act?.peopleRoster).map((p: any, i60: number) => (
                <Fragment key={i60}>
                  <button className="ixr" onClick={p?.go} style={css(p?.style)}>
                    <div style={{"display":"flex","alignItems":"center","gap":"11px","width":"100%","minWidth":"0"}}>
                      <span style={css(p?.avatarStyle)}>
                        {txt(p?.initials)}
                      </span>
                      <span style={{"flex":"1","minWidth":"0","display":"block"}}>
                        <span style={{"display":"flex","alignItems":"center","gap":"7px","minWidth":"0"}}>
                          <span style={{"flex":"none","fontSize":"13.5px","fontWeight":"600","letterSpacing":"-.15px","color":"var(--ink)"}}>
                            {txt(p?.name)}
                          </span>
                          <span style={css(p?.dotStyle)} />
                          <span style={css(p?.stateStyle)}>
                            {txt(p?.stateLabel)}
                          </span>
                        </span>
                        <span style={{"display":"block","fontSize":"11.5px","color":"var(--dim)","marginTop":"3px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                          {txt(p?.role)}
                        </span>
                      </span>
                      <span style={{"flex":"none","textAlign":"right"}}>
                        <span style={{"display":"block","fontFamily":"var(--mono)","fontSize":"17px","fontWeight":"var(--fig-weight,inherit)","letterSpacing":"-.5px","color":"var(--ink)"}}>
                          {txt(p?.actions)}
                        </span>
                        <span style={{"display":"block","fontFamily":"var(--mono)","fontSize":"8.5px","letterSpacing":"0.1em","color":"var(--faint)","marginTop":"1px"}}>
                          {"ACTIONS"}
                        </span>
                      </span>
                    </div>
                    <div style={{"display":"flex","alignItems":"center","gap":"8px","width":"100%","minWidth":"0"}}>
                      <span style={{"flex":"1","minWidth":"0","fontSize":"11.5px","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(p?.preview)}
                      </span>
                      {p?.waiting && (
                        <>
                          <span style={{"flex":"none","padding":"2px 8px","borderRadius":"var(--chip-r,7px)","background":"var(--warn-soft)","color":"var(--warn)","fontSize":"10px","whiteSpace":"nowrap"}}>
                            {txt(p?.waitLabel)}
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{"width":"100%","height":"2px","borderRadius":"2px","background":"var(--track)","overflow":"hidden"}}>
                      <div style={css(p?.barStyle)} />
                    </div>
                  </button>
                </Fragment>
              ))}
            </div>
          </>
        )}
        {v.act?.attentionLens && (
          <>
            <div style={{"display":"grid","gridTemplateColumns":"repeat(4,minmax(0,1fr))","gap":"12px"}}>
              {arr(v.act?.attentionKpis).map((k: any, i61: number) => (
                <Fragment key={i61}>
                  <div style={css(k?.style)}>
                    <div style={{"display":"flex","alignItems":"center","gap":"8px"}}>
                      <span style={css(cat("width:7px;height:7px;border-radius:2px;background:", k?.dot))} />
                      <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(k?.label)}
                      </span>
                    </div>
                    <div style={css(cat("font-family:var(--mono);font-size:28px;font-weight:var(--fig-weight,inherit);letter-spacing:-1px;margin-top:10px;color:", k?.valueColor))}>
                      {txt(k?.value)}
                    </div>
                    <div style={{"fontSize":"11.5px","color":"var(--faint)","marginTop":"6px"}}>
                      {txt(k?.hint)}
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
            {arr(v.act?.triage).map((g: any, i62: number) => (
              <Fragment key={i62}>
                {g?.any && (
                  <>
                    <div>
                      <div style={{"display":"flex","alignItems":"center","gap":"10px","marginTop":"22px","padding":"0 4px"}}>
                        <span style={css(g?.labelStyle)}>
                          {txt(g?.label)}
                        </span>
                        <span style={{"fontSize":"11.5px","color":"var(--faint)"}}>
                          {txt(g?.blurb)}
                        </span>
                        <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
                        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                          {txt(g?.count)}
                        </span>
                      </div>
                      <div style={{"display":"flex","flexDirection":"column","gap":"9px","marginTop":"11px"}}>
                        {arr(g?.rows).map((r: any, i63: number) => (
                          <Fragment key={i63}>
                            <div className="ixz" style={css(r?.style)}>
                              <span style={css(r?.railStyle)} />
                              <div style={{"display":"flex","alignItems":"center","gap":"9px","minWidth":"0"}}>
                                <span style={{"flex":"1","minWidth":"0","fontSize":"14px","fontWeight":"600","letterSpacing":"-.2px","color":"var(--ink)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                  {txt(r?.title)}
                                </span>
                                <span style={css(r?.chipStyle)}>
                                  {txt(r?.chip)}
                                </span>
                                <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)","whiteSpace":"nowrap"}}>
                                  {txt(r?.waited)}
                                </span>
                              </div>
                              <div style={{"fontSize":"12.5px","color":"var(--body)","lineHeight":"1.5","textWrap":"pretty"}}>
                                {txt(r?.note)}
                              </div>
                              <div style={{"fontSize":"12px","color":"var(--faint)","lineHeight":"1.5"}}>
                                {txt(r?.why)}
                              </div>
                              <div style={{"display":"flex","alignItems":"center","gap":"9px","flexWrap":"wrap","marginTop":"2px"}}>
                                <button className="ixb" onClick={r?.open} style={css(r?.primaryStyle)}>
                                  {txt(r?.primary)}
                                </button>
                                <button className="ix10" onClick={r?.open} style={{"flex":"none","height":"30px","padding":"0 13px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-ctl,10px)","fontSize":"12.5px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
                                  {txt(r?.secondary)}
                                </button>
                                <span style={{"flex":"1","minWidth":"20px"}} />
                                <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                                  {txt(r?.actor)}
                                </span>
                                <span style={{"width":"3px","height":"3px","borderRadius":"2px","background":"var(--track)"}} />
                                <span style={{"fontSize":"11.5px","color":"var(--faint)","paddingRight":"74px"}}>
                                  {txt(r?.rel)}
                                </span>
                              </div>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </Fragment>
            ))}
            {v.act?.triageEmpty && (
              <>
                <div style={{"marginTop":"14px","padding":"44px 18px","textAlign":"center","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)"}}>
                  <div style={{"fontSize":"15px","fontWeight":"600"}}>
                    {"Nothing needs you"}
                  </div>
                  <div style={{"fontSize":"12.5px","color":"var(--faint)","marginTop":"6px"}}>
                    {"No failures and no decisions parked. The audit trail below still has everything."}
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {v.act?.genericLens && (
          <>
            <div style={{"display":"grid","gridTemplateColumns":"repeat(4,1fr)","gap":"12px"}}>
              {arr(v.act?.kpis).map((k: any, i64: number) => (
                <Fragment key={i64}>
                  <button onClick={k?.pick} style={css(k?.style)}>
                    <div style={{"display":"flex","alignItems":"center","gap":"8px"}}>
                      <span style={css(cat("width:7px;height:7px;border-radius:2px;background:", k?.dot))} />
                      <span style={css(cat("flex:1;min-width:0;font-size:12.5px;color:", k?.labelColor, ";text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"))}>
                        {txt(k?.label)}
                      </span>
                    </div>
                    <div style={css(cat("font-family:var(--mono);font-size:28px;font-weight:var(--fig-weight,inherit);letter-spacing:-1px;margin-top:10px;text-align:left;color:", k?.valueColor))}>
                      {txt(k?.value)}
                    </div>
                    <div style={css(cat("font-size:11.5px;color:", k?.hintColor, ";margin-top:6px;text-align:left"))}>
                      {txt(k?.hint)}
                    </div>
                  </button>
                </Fragment>
              ))}
            </div>
          </>
        )}
        {v.act?.showLanes && (
          <>
            <div style={css(cat("display:grid;grid-template-columns:", v.act?.laneCols, ";gap:12px;margin-top:22px;align-items:start"))}>
              {arr(v.act?.streams).map((col: any, i65: number) => (
                <Fragment key={i65}>
                  <div className="ixz" onPointerEnter={col?.enter} onPointerLeave={col?.leave} style={css(cat("background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);backdrop-filter:blur(20px);box-shadow:var(--card-shadow);overflow:hidden;animation:glide .55s var(--ease) both;animation-delay:", col?.delay, ";transition:border-color .24s var(--ease)"))}>
                    <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"16px 18px 14px","borderBottom":"1px solid var(--border)"}}>
                      <span style={css(cat("width:26px;height:26px;flex:none;border-radius:var(--r-sm,9px);background:var(--chip);border:1px solid var(--chip-border);color:", col?.tint, ";display:flex;align-items:center;justify-content:center"))}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d={col?.icon} />
                        </svg>
                      </span>
                      <div style={{"flex":"1","minWidth":"0"}}>
                        <div style={{"fontSize":"13.5px","fontWeight":"600","letterSpacing":"-.1px"}}>
                          {txt(col?.title)}
                        </div>
                        <div style={{"fontSize":"11px","color":"var(--faint)","marginTop":"2px"}}>
                          {txt(col?.sub)}
                        </div>
                      </div>
                      <span style={css(cat("font-family:var(--mono);font-size:9.5px;letter-spacing:0.1em;color:", col?.stateColor))}>
                        {txt(col?.state)}
                      </span>
                    </div>
                    <div style={{"padding":"8px 10px 12px","maxHeight":"520px","overflow":"hidden"}}>
                      {arr(col?.items).map((e: any, i66: number) => (
                        <Fragment key={i66}>
                          <div onClick={e?.open} style={css(e?.style)}>
                            <span style={css(cat("position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:2px;background:", e?.rail, ";transition:background .3s var(--ease)"))} />
                            <div style={{"display":"flex","alignItems":"center","gap":"8px","minWidth":"0"}}>
                              <span style={css(cat("width:18px;height:18px;flex:none;border-radius:6px;background:var(--chip);border:1px solid var(--chip-border);color:", e?.srcTint, ";display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:7px;font-weight:600;letter-spacing:-.2px"))}>
                                {txt(e?.srcAbbr)}
                              </span>
                              <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","fontWeight":"600","lineHeight":"1.3","letterSpacing":"-.15px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                {txt(e?.title)}
                              </span>
                              {e?.showChip && (
                                <>
                                  <span style={css(e?.statusStyle)}>
                                    {txt(e?.status)}
                                  </span>
                                </>
                              )}
                              <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9px","color":"var(--faint)","whiteSpace":"nowrap"}}>
                                {txt(e?.short)}
                              </span>
                            </div>
                            <div style={{"fontSize":"11.5px","color":"var(--dim)","lineHeight":"1.45","marginTop":"5px","paddingLeft":"26px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                              {txt(e?.note)}
                            </div>
                            <div style={{"display":"flex","alignItems":"center","gap":"6px","marginTop":"6px","paddingLeft":"26px","minWidth":"0"}}>
                              <span style={{"flex":"none","maxWidth":"44%","fontSize":"10.5px","color":"var(--body)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                {txt(e?.actor)}
                              </span>
                              <span style={{"flex":"none","width":"3px","height":"3px","borderRadius":"2px","background":"var(--track)"}} />
                              <span style={{"flex":"1","minWidth":"0","fontSize":"10.5px","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                {txt(e?.rel)}
                              </span>
                              {e?.isWorking && (
                                <>
                                  <span style={css(cat("flex:none;font-family:var(--mono);font-size:9px;color:", e?.statusColor))}>
                                    {txt(e?.progress)}
                                  </span>
                                </>
                              )}
                            </div>
                            {e?.isWorking && (
                              <>
                                <div style={{"height":"2px","borderRadius":"2px","background":"var(--track)","overflow":"hidden","margin":"7px 0 0 26px"}}>
                                  <div style={css(cat("height:2px;border-radius:var(--r-sm,9px);width:", e?.progress, ";background:", e?.statusColor, ";transition:width .3s linear"))} />
                                </div>
                              </>
                            )}
                          </div>
                        </Fragment>
                      ))}
                      {col?.empty && (
                        <>
                          <div style={{"padding":"34px 12px","textAlign":"center","fontSize":"12.5px","color":"var(--faint)"}}>
                            {"Nothing matching that filter"}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          </>
        )}
        <div style={{"marginTop":"22px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px)","boxShadow":"var(--card-shadow)","overflow":"hidden"}}>
          <div style={{"display":"flex","alignItems":"flex-start","gap":"14px","padding":"20px 24px 16px"}}>
            <div style={{"flex":"1","minWidth":"0"}}>
              <div style={{"fontSize":"15px","fontWeight":"600","letterSpacing":"-.2px"}}>
                {"Audit trail"}
              </div>
              <div style={{"fontSize":"13px","color":"var(--dim)","marginTop":"5px"}}>
                {txt(v.act?.auditCaption)}
              </div>
            </div>
            <span style={{"flex":"none","display":"inline-flex","alignItems":"center","height":"24px","padding":"0 10px","borderRadius":"8px","background":"var(--chip)","border":"1px solid var(--chip-border)","fontSize":"11.5px","fontWeight":"500","color":"var(--body)"}}>
              {txt(v.act?.auditBadge)}
            </span>
          </div>
          <div style={{"display":"flex","flexWrap":"wrap","alignItems":"center","gap":"8px","padding":"0 24px 16px"}}>
            <div style={{"flex":"1","minWidth":"220px","display":"flex","alignItems":"center","gap":"9px","height":"34px","padding":"0 13px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-md,12px)"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" style={{"flex":"none"}}>
                <path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" />
              </svg>
              <input value={v.act?.query ?? ""} onChange={v.act?.setQuery} placeholder="Search every event, person, record or system" style={{"flex":"1","minWidth":"0","border":"0","outline":"0","background":"none","fontSize":"13px"}} />
            </div>
            {arr(v.act?.auditFilters).map((fl: any, i67: number) => (
              <Fragment key={i67}>
                <button onClick={fl?.pick} style={css(fl?.style)}>
                  {txt(fl?.label)}
                  {"\n"}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{"flex":"none","opacity":".5"}}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </Fragment>
            ))}
          </div>
          <div style={{"display":"grid","gridTemplateColumns":"1.1fr 1.7fr 1fr 1fr .8fr .7fr","borderTop":"1px solid var(--border)","background":"var(--surface-faint)"}}>
            {arr(v.act?.auditCols).map((c: any, i68: number) => (
              <Fragment key={i68}>
                <div style={{"padding":"10px 20px","fontSize":"11.5px","fontWeight":"500","color":"var(--faint)"}}>
                  {txt(c)}
                </div>
              </Fragment>
            ))}
          </div>
          {arr(v.act?.audit).map((r: any, i69: number) => (
            <Fragment key={i69}>
              <div className="ix11" onClick={r?.open} style={{"display":"grid","gridTemplateColumns":"1.1fr 1.7fr 1fr 1fr .8fr .7fr","borderTop":"1px solid var(--border)","cursor":"pointer","transition":"background .2s var(--ease)"}}>
                <div style={{"display":"flex","alignItems":"center","padding":"12px 20px","minWidth":"0","fontFamily":"var(--mono)","fontSize":"11.5px","color":"var(--dim)"}}>
                  {txt(r?.when)}
                </div>
                <div style={{"display":"flex","alignItems":"center","padding":"12px 20px","minWidth":"0","fontSize":"13px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                  {txt(r?.title)}
                </div>
                <div style={{"display":"flex","alignItems":"center","padding":"12px 20px","minWidth":"0","fontSize":"12.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                  {txt(r?.actor)}
                </div>
                <div style={{"display":"flex","alignItems":"center","padding":"12px 20px","minWidth":"0","fontSize":"12.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                  {txt(r?.rel)}
                </div>
                <div style={{"display":"flex","alignItems":"center","padding":"12px 20px","minWidth":"0","fontSize":"12.5px","color":"var(--dim)"}}>
                  {txt(r?.src)}
                </div>
                <div style={{"display":"flex","alignItems":"center","padding":"12px 20px","minWidth":"0"}}>
                  <span style={css(r?.statusStyle)}>
                    {txt(r?.status)}
                  </span>
                </div>
              </div>
            </Fragment>
          ))}
          <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"12px 24px","borderTop":"1px solid var(--border)","background":"var(--surface-faint)"}}>
            <span style={{"flex":"1","fontSize":"12px","color":"var(--faint)"}}>
              {txt(v.act?.auditFooter)}
            </span>
            <span style={{"fontSize":"12px","color":"var(--faint)"}}>
              {"Newest first"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
