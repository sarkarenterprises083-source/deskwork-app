{account && !account.isPaid && (
  <div className={`trial-banner${account.isTrialActive ? '' : ' expired'}`}>
    <span>
      {account.isTrialActive
        ? `Free trial - ${account.trialDaysLeft} day${account.trialDaysLeft === 1 ? '' : 's'} left`
        : 'Your free trial has ended - upgrade to keep using Deskwork without daily limits.'}
    </span>
    <div className="upgrade-buttons">
      <button className="stamp" onClick={() => handleUpgrade('basic')} disabled={upgrading}>
        {upgrading ? 'Opening checkout...' : 'Basic - Rs. 99/mo'}
      </button>
      <button className="stamp" onClick={() => handleUpgrade('pro')} disabled={upgrading}>
        {upgrading ? 'Opening checkout...' : 'Pro - Rs. 299/mo'}
      </button>
    </div>
  </div>
)}
