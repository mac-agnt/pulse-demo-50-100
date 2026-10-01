import { Fragment } from "react";
import { arr, cat, css, cx, txt } from "../../runtime/template";

type Props = { v: any };

export default function RecordsOntology({ v }: Props) {
  return (
    <>
      <div style={{"display":"flex","gap":"14px","alignItems":"stretch","height":"calc(100vh - 112px)","minHeight":"600px"}}>
        <div style={{"flex":"none","width":"252px","display":"flex","flexDirection":"column","gap":"10px","minWidth":"0","overflowY":"auto","scrollbarWidth":"none"}}>
          <div style={{"padding":"14px 16px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)"}}>
              {"KEYWORD SEARCH"}
            </div>
            <div className="ix13" style={{"display":"flex","alignItems":"center","gap":"8px","marginTop":"9px","padding":"0 12px","height":"36px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-md,13px)"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                <path d="M21.4 11.05 12.25 20.2a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" />
              </svg>
              <input value={v.onto?.query ?? ""} onChange={v.onto?.setQuery} onKeyDown={v.onto?.onKey} placeholder="e.g. invoices, approvals" style={{"flex":"1","minWidth":"0","border":"0","outline":"0","background":"none","fontSize":"12.5px","color":"var(--ink)"}} />
              {v.onto?.hasQuery && (
                <>
                  <button onClick={v.onto?.clear} aria-label="Clear" style={{"flex":"none","width":"18px","height":"18px","border":"0","borderRadius":"6px","background":"var(--chip)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center"}}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                      <path d="M6 6l12 12 M18 6 6 18" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            {v.onto?.hasResult && (
              <>
                <div style={{"marginTop":"10px","paddingTop":"10px","borderTop":"1px solid var(--border)"}}>
                  {v.onto?.resultEmpty && (
                    <>
                      <div style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                        {"No cluster matches \""}
                        {txt(v.onto?.query)}
                        {"\"."}
                      </div>
                    </>
                  )}
                  {v.onto?.resultFound && (
                    <>
                      <div style={{"fontSize":"11.5px","color":"var(--body)","lineHeight":"1.5"}}>
                        <span style={{"color":"var(--accent)"}}>
                          {txt(v.onto?.fromLabel)}
                        </span>
                        {" → "}
                        <span style={{"color":"var(--accent)"}}>
                          {txt(v.onto?.toLabel)}
                        </span>
                      </div>
                      <div style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)","marginTop":"5px"}}>
                        {txt(v.onto?.hopsLabel)}
                      </div>
                    </>
                  )}
                  {v.onto?.resultFan && (
                    <>
                      <div style={{"fontSize":"11.5px","color":"var(--body)","lineHeight":"1.5"}}>
                        {"Everything connected to "}
                        <span style={{"color":"var(--accent)"}}>
                          {txt(v.onto?.fromLabel)}
                        </span>
                      </div>
                      <div style={{"fontSize":"10.5px","color":"var(--dim)","marginTop":"5px","lineHeight":"1.5"}}>
                        {txt(v.onto?.connectedLabel)}
                      </div>
                    </>
                  )}
                  {v.onto?.resultNoPath && (
                    <>
                      <div style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                        {"No direct relationship found between matches."}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <div style={{"padding":"16px 18px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)"}}>
              {"GRAPH"}
            </div>
            <div style={{"display":"flex","alignItems":"baseline","gap":"8px","marginTop":"8px"}}>
              <span style={{"fontFamily":"var(--mono)","fontSize":"26px","fontWeight":"var(--fig-weight,inherit)","letterSpacing":"-1px","color":"var(--ink)"}}>
                {txt(v.graph?.nodeCount)}
              </span>
              <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                {"records"}
              </span>
            </div>
            <div style={{"display":"flex","alignItems":"baseline","gap":"8px","marginTop":"4px"}}>
              <span style={{"fontFamily":"var(--mono)","fontSize":"13px","color":"var(--body)"}}>
                {txt(v.graph?.edgeCount)}
              </span>
              <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                {"relationships"}
              </span>
            </div>
          </div>
          <div style={{"padding":"16px 18px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)"}}>
            <div style={{"display":"flex","alignItems":"baseline","gap":"8px"}}>
              <span style={{"flex":"1","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)"}}>
                {"LIVE QUERIES"}
              </span>
              <span style={{"fontFamily":"var(--mono)","fontSize":"9px","color":"var(--faint)"}}>
                {txt(v.graph?.running)}
              </span>
            </div>
            <div style={{"marginTop":"10px"}}>
              {arr(v.graph?.queries).map((q: any, i55: number) => (
                <Fragment key={i55}>
                  <div style={{"padding":"7px 0"}}>
                    <div style={{"display":"flex","alignItems":"center","gap":"8px"}}>
                      <span style={css(cat("width:7px;height:7px;flex:none;border-radius:2px;background:", q?.hue, ";box-shadow:0 0 8px ", q?.hue))} />
                      <span style={{"flex":"1","minWidth":"0","fontSize":"11.5px","color":"var(--body)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(q?.label)}
                      </span>
                      <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                        {txt(q?.detail)}
                      </span>
                    </div>
                    <div style={{"height":"2px","borderRadius":"2px","background":"var(--track)","overflow":"hidden","marginTop":"6px"}}>
                      <div style={css(cat("height:2px;border-radius:var(--r-sm,9px);width:", q?.progress, ";background:", q?.hue))} />
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
          <div style={{"padding":"14px 18px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)","marginBottom":"8px"}}>
              {"CLUSTERS"}
            </div>
            {arr(v.graph?.legend).map((l: any, i56: number) => (
              <Fragment key={i56}>
                <div style={{"display":"flex","alignItems":"center","gap":"9px","padding":"3px 0"}}>
                  <span style={css(cat("width:8px;height:8px;flex:none;border-radius:2px;background:", l?.bg, ";box-shadow:0 0 7px ", l?.bg))} />
                  <span style={{"flex":"1","minWidth":"0","fontSize":"11.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                    {txt(l?.label)}
                  </span>
                  <span style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
                    {txt(l?.count)}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
          <div style={{"flex":"1","minHeight":"0"}} />
          <button className={cx("ixp", "ixs")} onClick={v.graph?.run} style={{"height":"40px","display":"flex","alignItems":"center","justifyContent":"center","gap":"9px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"13.5px","fontWeight":"500","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l2.5-6 3.5 12 3-8 2 2h5" />
            </svg>
            {"Run a search"}
          </button>
        </div>
        <div style={{"position":"relative","flex":"1","minWidth":"0","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","overflow":"hidden"}}>
          <div style={{"position":"absolute","left":"50%","top":"-18%","width":"132%","height":"150%","transform":"translateX(-50%)","pointerEvents":"none","filter":"blur(74px)","opacity":".20","animation":"bloomDrift 26s ease-in-out infinite"}}>
            <div style={{"position":"absolute","left":"4%","top":"26%","width":"52%","height":"56%","borderRadius":"var(--r-sm,9px)","background":"var(--bloom-a)"}} />
            <div style={{"position":"absolute","left":"40%","top":"10%","width":"46%","height":"52%","borderRadius":"var(--r-sm,9px)","background":"var(--bloom-b)"}} />
            <div style={{"position":"absolute","left":"24%","top":"48%","width":"50%","height":"50%","borderRadius":"var(--r-sm,9px)","background":"var(--bloom-c)"}} />
          </div>
          <canvas data-onto-graph="1" style={{"position":"absolute","inset":"0","width":"100%","height":"100%","display":"block"}} />
        </div>
      </div>
    </>
  );
}
