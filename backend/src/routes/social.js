      envKeys: configured ? undefined : creds.envKeys, // admin/debug only — UI must not display raw keys
      setupHint: configured
        ? null
        : 'This platform is not configured by your admin yet. You can generate and copy posts; live Connect needs admin setup or a pasted token.',
