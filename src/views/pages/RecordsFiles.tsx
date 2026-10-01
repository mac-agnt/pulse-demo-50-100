import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";

type Props = { v: any };

export default function RecordsFiles({ v }: Props) {
  return (
    <>
      <div style={{"display":"flex","gap":"14px","alignItems":"stretch","height":"min(74vh,700px)","minHeight":"460px"}}>
        {v.tree?.open && (
          <>
            <div style={{"flex":"none","width":"266px","display":"flex","flexDirection":"column","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","overflow":"hidden","animation":"slideRight .3s var(--ease) both"}}>
              <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"9px","padding":"15px 16px 13px","borderBottom":"1px solid var(--border)"}}>
                <span style={{"flex":"1","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--faint)"}}>
                  {"FILE TREE"}
                </span>
                <button className="ixm" onClick={v.tree?.toggle} title="Close file tree" style={{"flex":"none","width":"26px","height":"26px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </button>
              </div>
              <div style={{"flex":"1","minHeight":"0","overflowY":"auto","padding":"8px 8px 12px"}}>
                {arr(v.tree?.rows).map((r: any, i51: number) => (
                  <Fragment key={i51}>
                    {r?.isFolder && (
                      <>
                        <button className="ix8" onClick={r?.toggle} style={css(cat("width:100%;display:flex;align-items:center;gap:8px;padding:7px 9px;padding-left:", r?.pad, ";background:none;border:0;border-radius:8px;cursor:pointer;font-size:12.5px;color:var(--body);text-align:left;transition:background .18s var(--ease)"))}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={css(cat("flex:none;transform:rotate(", r?.rot, ");transition:transform .22s var(--ease)"))}>
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                          <span style={{"flex":"1","minWidth":"0","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                            {txt(r?.name)}
                          </span>
                          <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                            {txt(r?.count)}
                          </span>
                        </button>
                      </>
                    )}
                    {r?.isFile && (
                      <>
                        <button className="ix8" onClick={r?.pick} style={css(r?.fileStyle)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                            <path d="M14 3v5h5 M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                          </svg>
                          <span style={{"flex":"1","minWidth":"0","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                            {txt(r?.name)}
                          </span>
                          {r?.indexed && (
                            <>
                              <span style={{"width":"5px","height":"5px","flex":"none","borderRadius":"2px","background":"var(--accent)"}} />
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
        <div style={{"flex":"1","minWidth":"0","display":"flex","flexDirection":"column","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","overflow":"hidden"}}>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"10px","padding":"13px 16px","borderBottom":"1px solid var(--border)"}}>
            {v.tree?.closed && (
              <>
                <button className="ixm" onClick={v.tree?.toggle} title="Open file tree" style={{"flex":"none","width":"30px","height":"30px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 6h5 M4.5 12h5 M4.5 18h5 M12.5 6h7 M12.5 12h7 M12.5 18h7" />
                  </svg>
                </button>
              </>
            )}
            <span style={{"flex":"1","minWidth":"0","fontFamily":"var(--mono)","fontSize":"10px","letterSpacing":"0.1em","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
              {txt(v.tree?.path)}
            </span>
            {v.tree?.searching && (
              <>
                <span style={{"flex":"none","padding":"3px 10px","borderRadius":"var(--chip-r,6px)","background":"var(--accent-faint)","border":"1px solid var(--accent-line)","fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--ink)"}}>
                  {txt(v.tree?.hits)}
                </span>
              </>
            )}
            <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.1em","color":"var(--faint)"}}>
              {txt(v.tree?.meta)}
            </span>
          </div>
          <div style={{"flex":"1","minHeight":"0","overflowY":"auto","padding":"26px 30px 34px"}}>
            <div style={{"maxWidth":"720px"}}>
              <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--faint)"}}>
                {txt(v.tree?.path)}
              </div>
              <h2 style={{"margin":"10px 0 0","fontSize":"26px","fontWeight":"500","letterSpacing":"-.9px"}}>
                {txt(v.tree?.fileTitle)}
              </h2>
              <div style={{"display":"flex","flexWrap":"wrap","gap":"16px","marginTop":"14px"}}>
                {arr(v.tree?.facts).map((k: any, i52: number) => (
                  <Fragment key={i52}>
                    <div>
                      <div style={{"fontFamily":"var(--mono)","fontSize":"8.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                        {txt(k?.k)}
                      </div>
                      <div style={{"fontSize":"12.5px","color":"var(--body)","marginTop":"4px"}}>
                        {txt(k?.v)}
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
              <div style={{"height":"1px","background":"var(--border)","margin":"22px 0"}} />
              {arr(v.tree?.body).map((b: any, i53: number) => (
                <Fragment key={i53}>
                  <p style={{"margin":"0 0 16px","fontSize":"14px","lineHeight":"1.75","color":"var(--body)","textWrap":"pretty"}}>
                    {txt(b)}
                  </p>
                </Fragment>
              ))}
              <div style={{"marginTop":"10px","padding":"15px 17px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)"}}>
                <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                  {"LINKED RECORDS"}
                </div>
                <div style={{"display":"flex","flexWrap":"wrap","gap":"8px","marginTop":"10px"}}>
                  {arr(v.tree?.links).map((l: any, i54: number) => (
                    <Fragment key={i54}>
                      <button className="ixu" onClick={l?.open} style={{"height":"30px","padding":"0 12px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"12px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
                        {txt(l?.label)}
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
