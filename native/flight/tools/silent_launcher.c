/* MIT. Native launch boundary: Dummy output and master-mute flag precede Godot. */
#include <mach-o/dyld.h>
#include <sys/stat.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
int main(int argc,char **argv){
 char raw[PATH_MAX],exe[PATH_MAX],runtime[PATH_MAX],marker[PATH_MAX],profile[PATH_MAX];
 uint32_t capacity=sizeof(raw);
 if(_NSGetExecutablePath(raw,&capacity)||!realpath(raw,exe)){perror("Flight Islands launcher");return 78;}
 char *slash=strrchr(exe,'/');if(!slash)return 78;*slash=0;
 snprintf(runtime,sizeof(runtime),"%s/Flight Islands",exe);
 snprintf(marker,sizeof(marker),"%s/../Resources/test-profile.txt",exe);
 char **engine=calloc((size_t)argc+12,sizeof(char*));
 char **user=calloc((size_t)argc+4,sizeof(char*));
 if(!engine||!user)return 71;
 int n=0,u=0,separator=0,skip=0,has_profile=0;
 engine[n++]=runtime;
 for(int i=1;i<argc;i++){
  if(separator){user[u++]=argv[i];if(!strncmp(argv[i],"--profile-dir=",14))has_profile=1;continue;}
  if(skip){skip=0;continue;}
  if(!strcmp(argv[i],"--")){separator=1;continue;}
  if(!strcmp(argv[i],"--audio-driver")){skip=1;continue;}
  engine[n++]=argv[i];
 }
 engine[n++]="--audio-driver";engine[n++]="Dummy";engine[n++]="--";
 for(int i=0;i<u;i++)engine[n++]=user[i];
 engine[n++]="--test-muted";
 if(!has_profile){
  FILE *file=fopen(marker,"r");profile[0]=0;
  if(file){if(fgets(profile,sizeof(profile),file))profile[strcspn(profile,"\r\n")]=0;fclose(file);}
  if(!profile[0]){
   const char *home=getenv("HOME");if(!home)return 78;
   snprintf(profile,sizeof(profile),"%s/Library/Application Support/Godot/app_userdata/Flight Islands/profile",home);
  }
  size_t length=strlen(profile)+15;char *argument=malloc(length);if(!argument)return 71;
  snprintf(argument,length,"--profile-dir=%s",profile);engine[n++]=argument;
 }
 engine[n]=NULL;execv(runtime,engine);perror("Flight Islands engine");return 71;
}
