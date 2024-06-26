## Minimal Maven Install via `Engine`, `SDLC`, and `Studio`
https://github.com/finos/legend/blob/master/installers/maven/README.md?plain=1#L3
- [X] `Engine`
- [X] `SDLC`
- [X] `Studio`

<img src="legend_arch.svg" width="600" />

### Setup
1. Follow the instructions to set up a GitLab app from https://github.com/finos/legend/blob/master/installers/maven/README.md?plain=1#L17-L28
2. Collect your Gitlab app's `APP_ID` and `APP_SECRET` and store them in environment variables
3. Invoke `dagger call minimal --app-id env:APP_ID --app-secret env:APP_SECRET up` to bring up the services 
4. Browse to http://localhost:9000/studio and authenticate via gitlab.com oauth/OIDC
